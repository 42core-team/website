package kube

import (
	_ "embed"
	"fmt"
	"regexp"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/util/yaml"
)

//go:embed helper_images.yaml
var helperImagesManifest []byte

var pinnedImageReference = regexp.MustCompile(`^[^@\s]+@sha256:[0-9a-f]{64}$`)

var netGuardImage, repoCloneImage = loadHelperImages(helperImagesManifest)

func loadHelperImages(manifest []byte) (string, string) {
	var template corev1.PodTemplate
	if err := yaml.UnmarshalStrict(manifest, &template); err != nil {
		panic(fmt.Errorf("parse embedded helper images: %w", err))
	}

	images := make(map[string]string, len(template.Template.Spec.Containers))
	for _, container := range template.Template.Spec.Containers {
		if _, exists := images[container.Name]; exists {
			panic(fmt.Sprintf("duplicate embedded helper image %q", container.Name))
		}
		images[container.Name] = container.Image
	}
	for _, name := range []string{"net-guard", "clone-repo"} {
		if !pinnedImageReference.MatchString(images[name]) {
			panic(fmt.Sprintf("embedded helper image %q must be pinned by SHA-256 digest", name))
		}
	}
	return images["net-guard"], images["clone-repo"]
}
