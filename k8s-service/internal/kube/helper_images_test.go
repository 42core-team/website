package kube

import (
	"regexp"
	"testing"
)

var pinnedByDigest = regexp.MustCompile(`@sha256:[0-9a-f]{64}$`)

func TestHelperImagesArePinnedByDigest(t *testing.T) {
	for name, image := range map[string]string{
		"netGuardImage":  netGuardImage,
		"repoCloneImage": repoCloneImage,
	} {
		if !pinnedByDigest.MatchString(image) {
			t.Errorf("%s = %q, want a reference ending in @sha256:<64 hex>", name, image)
		}
	}
}
