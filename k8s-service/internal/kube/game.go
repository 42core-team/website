package kube

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func (c *Client) CreateGameJob(game *Game) error {
	presignedURL, err := c.s3Client.GeneratePresignedUploadURL(game.ID)
	if err != nil {
		return fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	var botIDs []string
	botIDMapping := make(map[string]string)
	var playerNameEnvs []corev1.EnvVar
	for ind := range game.Bots {
		id, err := generateRandomID(2)
		if err != nil {
			return fmt.Errorf("error generating rnd IDs for bots %w", err)
		}
		game.Bots[ind].RndID = &id
		botIDs = append(botIDs, id)
		botIDMapping[id] = game.Bots[ind].ID.String()

		if game.Bots[ind].Name != nil && *game.Bots[ind].Name != "" {
			playerNameEnvs = append(playerNameEnvs, corev1.EnvVar{
				Name:  fmt.Sprintf("PLAYER_%s_NAME", id),
				Value: *game.Bots[ind].Name,
			})
		}
	}

	botMappingJSON, err := json.Marshal(botIDMapping)
	if err != nil {
		return fmt.Errorf("failed to marshal bot ID mapping: %w", err)
	}

	var volumes []corev1.Volume
	var initContainers []corev1.Container
	var botContainers []corev1.Container

	// Security context helpers
	botRunAsUser := int64(2000) // untrusted bots
	//serverRunAsUser := int64(1000) // trusted game server
	runAsNonRootTrue := true
	readOnlyRootTrue := true
	allowPrivilegeEscalationFalse := false
	automountSATokenFalse := false
	enableServiceLinksFalse := false

	volumeSizeLimit := resource.MustParse("250Mi")

	// Define and create ConfigMap for game config
	configMapName := "game-config-" + game.ID.String()
	configMap := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      configMapName,
			Namespace: c.namespace,
		},
		Data: map[string]string{
			"server.game.config": game.GameConfig,
		},
	}

	_, err = c.clientset.CoreV1().ConfigMaps(c.namespace).Create(context.TODO(), configMap, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("failed to create configmap: %w", err)
	}

	volumes = append(volumes, corev1.Volume{
		Name: "game-config",
		VolumeSource: corev1.VolumeSource{
			ConfigMap: &corev1.ConfigMapVolumeSource{
				LocalObjectReference: corev1.LocalObjectReference{
					Name: configMapName,
				},
			},
		},
	})

	for _, bot := range game.Bots {
		volumeName := "shared-data-" + bot.ID.String()
		initContainerName := "clone-repo-" + bot.ID.String()
		containerName := "bot-" + bot.ID.String()

		volumes = append(volumes, corev1.Volume{
			Name: volumeName,
			VolumeSource: corev1.VolumeSource{
				EmptyDir: &corev1.EmptyDirVolumeSource{
					SizeLimit: &volumeSizeLimit,
				},
			},
		})

		initContainers = append(initContainers, corev1.Container{
			Name:  initContainerName,
			Image: "alpine/git",
			Command: []string{
				"sh", "-c", fmt.Sprintf(`
					set -eu;
					echo '--- Cloning repository (verbose, progress) ---';
					GIT_TERMINAL_PROMPT=0 git clone --single-branch --depth 1 --verbose --progress %s /shared-data/repo;
					cd /shared-data/repo;
					echo '--- Last commit ---';
					git --no-pager log -1 --decorate=short --pretty=fuller;
					echo '--- Diffstat ---';
					git --no-pager show --stat -1;
					echo '--- changing permissions ---'
					chown -R 2000:2000 /shared-data/repo && chmod -R 770 /shared-data/repo;
				`, bot.RepoURL),
			},
			VolumeMounts: []corev1.VolumeMount{
				{
					Name:      volumeName,
					MountPath: "/shared-data",
				},
			},
			//SecurityContext: &corev1.SecurityContext{
			//	AllowPrivilegeEscalation: &allowPrivilegeEscalationFalse,
			//	SeccompProfile: &corev1.SeccompProfile{
			//		Type: corev1.SeccompProfileTypeRuntimeDefault,
			//	},
			//	Capabilities: &corev1.Capabilities{Drop: []corev1.Capability{"ALL"}},
			//},
			Resources: corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceCPU:    resource.MustParse("100m"),
					corev1.ResourceMemory: resource.MustParse("128Mi"),
				},
				Limits: corev1.ResourceList{
					corev1.ResourceCPU:    resource.MustParse("500m"),
					corev1.ResourceMemory: resource.MustParse("512Mi"),
				},
			},
		})

		botContainers = append(botContainers, corev1.Container{
			Name:            containerName,
			Image:           bot.Image,
			ImagePullPolicy: corev1.PullAlways,
			Command: []string{
				"sh", "-c", fmt.Sprintf("cd /shared-data/repo/my-core-bot && make && ./bot %s", *bot.RndID),
			},
			VolumeMounts: []corev1.VolumeMount{
				{
					Name:      volumeName,
					MountPath: "/shared-data",
				},
			},
			SecurityContext: &corev1.SecurityContext{
				RunAsUser:                &botRunAsUser,
				RunAsNonRoot:             &runAsNonRootTrue,
				AllowPrivilegeEscalation: &allowPrivilegeEscalationFalse,
				ReadOnlyRootFilesystem:   &readOnlyRootTrue,
				SeccompProfile: &corev1.SeccompProfile{
					Type: corev1.SeccompProfileTypeRuntimeDefault,
				},
				Capabilities: &corev1.Capabilities{Drop: []corev1.Capability{"ALL"}},
			},
			Resources: corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceCPU:    resource.MustParse("250m"),
					corev1.ResourceMemory: resource.MustParse("256Mi"),
				},
				Limits: corev1.ResourceList{
					corev1.ResourceCPU:    resource.MustParse("1"),
					corev1.ResourceMemory: resource.MustParse("512Mi"),
				},
			},
		})
	}

	gameEnv := []corev1.EnvVar{
		{Name: "GAME_ID", Value: game.ID.String()},
		{Name: "SEND_RESULTS", Value: "true"},
		{Name: "RABBITMQ_URL", Value: c.cfg.RabbitMQHTTP + "/api/exchanges/%2f/amq.direct/publish"},
		{Name: "S3_PRESIGNED_URL", Value: presignedURL},
		{Name: "UPLOAD_REPLAY", Value: "true"},
		{Name: "BOT_ID_MAPPING", Value: string(botMappingJSON)},
	}
	gameEnv = append(gameEnv, playerNameEnvs...)

	mainContainer := corev1.Container{
		Name:  "game",
		Image: game.Image,
		Args:  botIDs,
		Env:   gameEnv,
		SecurityContext: &corev1.SecurityContext{
			//RunAsUser: &serverRunAsUser,
			//RunAsNonRoot:             &runAsNonRootTrue,
			AllowPrivilegeEscalation: &allowPrivilegeEscalationFalse,
			SeccompProfile: &corev1.SeccompProfile{
				Type: corev1.SeccompProfileTypeRuntimeDefault,
			},
			Capabilities: &corev1.Capabilities{Drop: []corev1.Capability{"ALL"}},
		},
		VolumeMounts: []corev1.VolumeMount{
			{
				Name:      "game-config",
				MountPath: "/core/configs/server.game.config",
				SubPath:   "server.game.config",
			},
		},
		Resources: corev1.ResourceRequirements{
			Requests: corev1.ResourceList{
				corev1.ResourceCPU:    resource.MustParse("500m"),
				corev1.ResourceMemory: resource.MustParse("512Mi"),
			},
			Limits: corev1.ResourceList{
				corev1.ResourceCPU:    resource.MustParse("2"),
				corev1.ResourceMemory: resource.MustParse("1Gi"),
			},
		},
	}

	// Final init container that installs iptables rules to restrict bot egress to loopback only.
	// Requires NET_ADMIN but runs before app containers start.
	initContainers = append(initContainers, corev1.Container{
		Name:  "net-guard",
		Image: "ghcr.io/paulicstudios/alpine-iptables:latest",
		Command: []string{
			"sh", "-c", fmt.Sprintf(`
				set -eux;
				# Block all non-loopback egress for bot UID
				iptables -I OUTPUT 1 -m owner --uid-owner %d ! -o lo -j DROP;
				ip6tables -I OUTPUT 1 -m owner --uid-owner %d ! -o lo -j DROP;
			`, botRunAsUser, botRunAsUser),
		},
		SecurityContext: &corev1.SecurityContext{
			RunAsUser: func(i int64) *int64 { return &i }(0),
			Capabilities: &corev1.Capabilities{
				Add: []corev1.Capability{"NET_ADMIN"},
			},
			AllowPrivilegeEscalation: &allowPrivilegeEscalationFalse,
			SeccompProfile: &corev1.SeccompProfile{
				Type: corev1.SeccompProfileTypeRuntimeDefault,
			},
		},
		Resources: corev1.ResourceRequirements{
			Requests: corev1.ResourceList{
				corev1.ResourceCPU:    resource.MustParse("10m"),
				corev1.ResourceMemory: resource.MustParse("32Mi"),
			},
			Limits: corev1.ResourceList{
				corev1.ResourceCPU:    resource.MustParse("100m"),
				corev1.ResourceMemory: resource.MustParse("128Mi"),
			},
		},
	})

	podSpec := corev1.PodSpec{
		Volumes:                      volumes,
		InitContainers:               initContainers,
		Containers:                   append([]corev1.Container{mainContainer}, botContainers...),
		RestartPolicy:                corev1.RestartPolicyNever,
		AutomountServiceAccountToken: &automountSATokenFalse,
		EnableServiceLinks:           &enableServiceLinksFalse,
		HostNetwork:                  false,
		HostPID:                      false,
		HostIPC:                      false,
	}

	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "game-" + game.ID.String(),
			Namespace: c.namespace,
		},
		Spec: batchv1.JobSpec{
			Completions:             int32Ptr(1),
			BackoffLimit:            int32Ptr(0),
			ActiveDeadlineSeconds:   int64Ptr(60 * 15),
			TTLSecondsAfterFinished: int32Ptr(60 * 60 * 6),
			Template: corev1.PodTemplateSpec{
				Spec: podSpec,
			},
		},
	}

	createdJob, err := c.clientset.BatchV1().Jobs(c.namespace).Create(context.TODO(), job, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("failed to create job: %v", err)
	}

	// Set OwnerReference for ConfigMap to the Job for automatic cleanup
	configMap.ObjectMeta.OwnerReferences = []metav1.OwnerReference{
		{
			APIVersion: "batch/v1",
			Kind:       "Job",
			Name:       createdJob.Name,
			UID:        createdJob.UID,
		},
	}
	_, err = c.clientset.CoreV1().ConfigMaps(c.namespace).Update(context.TODO(), configMap, metav1.UpdateOptions{})
	if err != nil {
		c.logger.Errorf("failed to set owner reference on configmap %s: %v", configMapName, err)
	}

	c.logger.Infoln("Job to run a game successfully created", "jobName", createdJob.Name)
	return nil
}

func int32Ptr(i int32) *int32 {
	return &i
}

func int64Ptr(i int64) *int64 {
	return &i
}

func generateRandomID(n int) (string, error) {
	b := make([]byte, n)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	var num uint64
	for i := 0; i < len(b) && i < 8; i++ {
		num = (num << 8) | uint64(b[i])
	}
	return fmt.Sprintf("%d", num), nil
}
