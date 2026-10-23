package kube

import (
	"context"
	"errors"
	"testing"

	"go.uber.org/zap"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes/fake"
	k8stesting "k8s.io/client-go/testing"
)

const testNamespace = "games"

func newTestResources(t *testing.T) *gameResources {
	t.Helper()
	game := newTestGame("bot", "https://github.com/core-org/team-repo", testToken)
	res, err := buildGameResources(game, testNamespace, "", "")
	if err != nil {
		t.Fatalf("buildGameResources: %v", err)
	}
	return res
}

func failWith(err error) k8stesting.ReactionFunc {
	return func(action k8stesting.Action) (bool, runtime.Object, error) {
		return true, nil, err
	}
}

func TestCreateGameResourcesSetsConfigMapOwnerBeforeSecret(t *testing.T) {
	res := newTestResources(t)
	clientset := fake.NewClientset()

	if err := createGameResources(context.Background(), clientset, testNamespace, zap.NewNop().Sugar(), res); err != nil {
		t.Fatalf("createGameResources: %v", err)
	}

	var order []string
	for _, action := range clientset.Actions() {
		order = append(order, action.GetVerb()+" "+action.GetResource().Resource)
	}
	want := []string{"create configmaps", "create jobs", "update configmaps", "create secrets"}
	if len(order) != len(want) {
		t.Fatalf("unexpected actions %v, want %v", order, want)
	}
	for i := range want {
		if order[i] != want[i] {
			t.Fatalf("unexpected actions %v, want %v", order, want)
		}
	}

	configMap, err := clientset.CoreV1().ConfigMaps(testNamespace).Get(context.Background(), res.configMap.Name, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get configmap: %v", err)
	}
	if len(configMap.OwnerReferences) != 1 || configMap.OwnerReferences[0].Kind != "Job" {
		t.Errorf("configmap is not owned by the job: %+v", configMap.OwnerReferences)
	}
}

func TestCreateGameResourcesDeletesJobWhenSecretFails(t *testing.T) {
	res := newTestResources(t)
	clientset := fake.NewClientset()
	clientset.PrependReactor("create", "secrets", failWith(apierrors.NewForbidden(schema.GroupResource{Resource: "secrets"}, "", errors.New("denied"))))

	err := createGameResources(context.Background(), clientset, testNamespace, zap.NewNop().Sugar(), res)
	if err == nil {
		t.Fatal("expected an error when the secret cannot be created")
	}

	_, err = clientset.BatchV1().Jobs(testNamespace).Get(context.Background(), res.job.Name, metav1.GetOptions{})
	if !apierrors.IsNotFound(err) {
		t.Errorf("expected the job to be deleted, got %v", err)
	}
	for _, action := range clientset.Actions() {
		if action.GetVerb() != "delete" || action.GetResource().Resource != "jobs" {
			continue
		}
		deleteAction := action.(k8stesting.DeleteAction)
		policy := deleteAction.GetDeleteOptions().PropagationPolicy
		if policy == nil || *policy != metav1.DeletePropagationBackground {
			t.Errorf("job must be deleted with background propagation, got %v", policy)
		}
	}
}

func TestCreateGameResourcesKeepsConfigMapWhenExistingJobLookupFails(t *testing.T) {
	res := newTestResources(t)
	existingJob := res.job.DeepCopy()
	clientset := fake.NewClientset(existingJob, res.configMap.DeepCopy())
	clientset.PrependReactor("get", "jobs", failWith(apierrors.NewServiceUnavailable("try again")))

	err := createGameResources(context.Background(), clientset, testNamespace, zap.NewNop().Sugar(), res)
	if err == nil {
		t.Fatal("expected an error when the existing job cannot be read")
	}

	if _, err := clientset.CoreV1().ConfigMaps(testNamespace).Get(context.Background(), res.configMap.Name, metav1.GetOptions{}); err != nil {
		t.Errorf("configmap of the existing job must not be deleted: %v", err)
	}
}

func TestCreateGameResourcesDeletesConfigMapWhenJobCreateFails(t *testing.T) {
	res := newTestResources(t)
	clientset := fake.NewClientset()
	clientset.PrependReactor("create", "jobs", failWith(apierrors.NewServiceUnavailable("try again")))

	err := createGameResources(context.Background(), clientset, testNamespace, zap.NewNop().Sugar(), res)
	if err == nil {
		t.Fatal("expected an error when the job cannot be created")
	}

	_, err = clientset.CoreV1().ConfigMaps(testNamespace).Get(context.Background(), res.configMap.Name, metav1.GetOptions{})
	if !apierrors.IsNotFound(err) {
		t.Errorf("expected the configmap to be deleted, got %v", err)
	}
}

func TestBuildGameResourcesMarksInvalidGames(t *testing.T) {
	game := newTestGame("bot", "https://org:token@github.com/core-org/team-repo", testToken)
	_, err := buildGameResources(game, testNamespace, "", "")
	if !errors.Is(err, ErrInvalidGame) {
		t.Fatalf("expected ErrInvalidGame, got %v", err)
	}
}
