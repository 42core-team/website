package kube

import (
	"context"
	"errors"
	"testing"
	"time"

	"go.uber.org/zap"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
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
	res, err := buildGameResources(game, testNamespace, "", "", "")
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
	_, err := buildGameResources(game, testNamespace, "", "", "")
	if !errors.Is(err, ErrInvalidGame) {
		t.Fatalf("expected ErrInvalidGame, got %v", err)
	}
}

func TestBuildGameResourcesSetsResultQueue(t *testing.T) {
	game := newTestGame("bot", "https://github.com/core-org/team-repo", testToken)
	res, err := buildGameResources(game, testNamespace, "", "", "dev_game_results")
	if err != nil {
		t.Fatalf("buildGameResources: %v", err)
	}
	for _, container := range res.job.Spec.Template.Spec.Containers {
		for _, item := range container.Env {
			if item.Name == "RABBITMQ_RESULTS_QUEUE" {
				if item.Value != "dev_game_results" {
					t.Errorf("result queue = %q, want %q", item.Value, "dev_game_results")
				}
				return
			}
		}
	}
	t.Error("game container has no RABBITMQ_RESULTS_QUEUE")
}

func existingJobWithCondition(res *gameResources, conditionType batchv1.JobConditionType) *batchv1.Job {
	job := res.job.DeepCopy()
	job.UID = "old-run"
	if conditionType != "" {
		job.Status.Conditions = []batchv1.JobCondition{{Type: conditionType, Status: corev1.ConditionTrue}}
	} else {
		job.Status.Active = 1
	}
	return job
}

func TestCreateGameResourcesReplacesFailedJob(t *testing.T) {
	res := newTestResources(t)
	oldConfigMap := res.configMap.DeepCopy()
	oldConfigMap.Data = map[string]string{"game.config.json": "old"}
	oldSecret := res.credentialsSecret.DeepCopy()
	oldSecret.Data = map[string][]byte{"old": []byte("expired token")}
	clientset := fake.NewClientset(existingJobWithCondition(res, batchv1.JobFailed), oldConfigMap, oldSecret)

	if err := createGameResources(context.Background(), clientset, testNamespace, zap.NewNop().Sugar(), res); err != nil {
		t.Fatalf("createGameResources: %v", err)
	}

	ctx := context.Background()
	job, err := clientset.BatchV1().Jobs(testNamespace).Get(ctx, res.job.Name, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get job: %v", err)
	}
	if job.UID == "old-run" || len(job.Status.Conditions) != 0 {
		t.Errorf("failed job was not replaced: %+v", job)
	}
	configMap, err := clientset.CoreV1().ConfigMaps(testNamespace).Get(ctx, res.configMap.Name, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get configmap: %v", err)
	}
	if configMap.Data["game.config.json"] == "old" {
		t.Error("configmap of the failed run was kept")
	}
	secret, err := clientset.CoreV1().Secrets(testNamespace).Get(ctx, res.credentialsSecret.Name, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get secret: %v", err)
	}
	if _, stale := secret.Data["old"]; stale {
		t.Error("credentials secret of the failed run was kept")
	}

	for _, action := range clientset.Actions() {
		if action.GetVerb() != "delete" || action.GetResource().Resource != "jobs" {
			continue
		}
		policy := action.(k8stesting.DeleteAction).GetDeleteOptions().PropagationPolicy
		if policy == nil || *policy != metav1.DeletePropagationForeground {
			t.Errorf("failed job must be deleted with foreground propagation, got %v", policy)
		}
	}
}

func TestCreateGameResourcesKeepsActiveAndSucceededJobs(t *testing.T) {
	for name, condition := range map[string]batchv1.JobConditionType{
		"active":    "",
		"succeeded": batchv1.JobComplete,
	} {
		t.Run(name, func(t *testing.T) {
			res := newTestResources(t)
			existing := existingJobWithCondition(res, condition)
			clientset := fake.NewClientset(existing, res.configMap.DeepCopy())

			if err := createGameResources(context.Background(), clientset, testNamespace, zap.NewNop().Sugar(), res); err != nil {
				t.Fatalf("createGameResources: %v", err)
			}

			for _, action := range clientset.Actions() {
				if action.GetVerb() == "delete" {
					t.Errorf("unexpected delete of %s", action.GetResource().Resource)
				}
			}
			job, err := clientset.BatchV1().Jobs(testNamespace).Get(context.Background(), res.job.Name, metav1.GetOptions{})
			if err != nil {
				t.Fatalf("get job: %v", err)
			}
			if job.UID != "old-run" {
				t.Errorf("existing job was replaced")
			}
		})
	}
}

func TestCreateGameResourcesFailsWhenFailedJobIsNotDeletedInTime(t *testing.T) {
	timeout, interval := jobDeletionTimeout, jobDeletionPollInterval
	jobDeletionTimeout, jobDeletionPollInterval = 50*time.Millisecond, 10*time.Millisecond
	t.Cleanup(func() { jobDeletionTimeout, jobDeletionPollInterval = timeout, interval })

	res := newTestResources(t)
	clientset := fake.NewClientset(existingJobWithCondition(res, batchv1.JobFailed), res.configMap.DeepCopy())
	// A finalizer keeps the Job around: the delete is accepted but nothing goes.
	clientset.PrependReactor("delete", "jobs", func(action k8stesting.Action) (bool, runtime.Object, error) {
		return true, nil, nil
	})

	err := createGameResources(context.Background(), clientset, testNamespace, zap.NewNop().Sugar(), res)
	if err == nil {
		t.Fatal("expected an error while the failed job still exists")
	}
	for _, action := range clientset.Actions() {
		if action.GetVerb() == "create" && action.GetResource().Resource == "secrets" {
			t.Error("secret must not be created for a job that was not replaced")
		}
	}
}
