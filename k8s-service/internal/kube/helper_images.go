package kube

// The helper images below run in every game pod and are pinned by digest
// instead of a mutable tag: net-guard runs as root with NET_ADMIN and the
// clone container holds the repository clone token, so a moved tag must not
// change what runs there.
//
// To update a digest, resolve the multi-arch index digest and replace the
// sha256 value (keep the version tag for readability):
//
//	docker buildx imagetools inspect <image>:<tag>   # use the top-level "Digest:" line
//
// Both digests were resolved on 2026-11-18. Neither container sets
// ImagePullPolicy, so Kubernetes defaults the digest-pinned images to
// IfNotPresent.
const (
	// netGuardImage is ghcr.io/paulicstudios/alpine-iptables:latest (linux/amd64, linux/arm64).
	netGuardImage = "ghcr.io/paulicstudios/alpine-iptables:latest@sha256:3bcd6c8e4661e4987c88b240de32e81045b3d7e323a010f0ab2c07132a5c2f3f"
	// repoCloneImage is alpine/git v2.54.1, which `latest` pointed to on 2026-11-18.
	repoCloneImage = "alpine/git:v2.54.1@sha256:2306e2b05ee0ef99f5d25b0779f645b24ae9f91ba187107503592fcdfe78da3a"
)
