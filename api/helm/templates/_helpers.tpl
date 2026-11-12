{{/*
Expand the name of the chart.
*/}}
{{- define "api.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "api.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "api.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "api.labels" -}}
helm.sh/chart: {{ include "api.chart" . }}
{{ include "api.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "api.selectorLabels" -}}
app.kubernetes.io/name: {{ include "api.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "api.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "api.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/* Names reserve suffix space so long release names remain valid. */}}
{{- define "api.traefikName" -}}
{{- $name := include "api.fullname" .root -}}
{{- if gt (len $name) 45 -}}
{{- $name = printf "%s-%s" ($name | trunc 36 | trimSuffix "-") ($name | sha256sum | trunc 8) -}}
{{- end -}}
{{- printf "%s-%s" $name .suffix -}}
{{- end }}

{{/* Native annotations exclude controller-specific and preview issuer settings. */}}
{{- define "api.traefikAnnotations" -}}
{{- $root := .root -}}
{{- $annotations := dict -}}
{{- range $key, $value := $root.Values.ingress.annotations -}}
  {{- if and (not (hasPrefix "nginx.ingress.kubernetes.io/" $key)) (ne $key "kubernetes.io/ingress.class") -}}
    {{- if not (and $.preview (or (hasPrefix "cert-manager.io/" $key) (hasPrefix "acme.cert-manager.io/" $key) (hasPrefix "external-dns.alpha.kubernetes.io/" $key) (hasPrefix "external-dns.kubernetes.io/" $key))) -}}
      {{- $_ := set $annotations $key $value -}}
    {{- end -}}
  {{- end -}}
{{- end -}}
{{- $_ := set $annotations "traefik.ingress.kubernetes.io/router.entrypoints" "websecure" -}}
{{- $_ := set $annotations "traefik.ingress.kubernetes.io/router.tls" "true" -}}
{{- $headers := include "api.traefikName" (dict "root" $root "suffix" "cors") -}}
{{- $buffer := include "api.traefikName" (dict "root" $root "suffix" "upload-limit") -}}
{{- $chain := printf "%s-%s@kubernetescrd,%s-%s@kubernetescrd" $root.Release.Namespace $headers $root.Release.Namespace $buffer -}}
{{- with index $annotations "traefik.ingress.kubernetes.io/router.middlewares" -}}
{{- $chain = printf "%s,%s" $chain . -}}
{{- end -}}
{{- $_ := set $annotations "traefik.ingress.kubernetes.io/router.middlewares" $chain -}}
{{- toYaml $annotations -}}
{{- end }}

{{- define "api.validateTraefik" -}}
{{- $native := eq .Values.ingress.className "traefik" -}}
{{- if or $native .Values.ingress.traefik.preview -}}
  {{- if not .Values.ingress.enabled -}}{{- fail "Traefik requires ingress.enabled=true" -}}{{- end -}}
  {{- if and $native .Values.ingress.traefik.preview -}}{{- fail "Disable ingress.traefik.preview when cutting the primary ingress over to traefik" -}}{{- end -}}
  {{- if and .Values.ingress.traefik.preview (ne .Values.ingress.className "nginx") -}}{{- fail "Traefik preview requires the primary ingress.className=nginx" -}}{{- end -}}
  {{- $legacyClass := index .Values.ingress.annotations "kubernetes.io/ingress.class" -}}
  {{- if and .Values.ingress.traefik.preview $legacyClass (ne $legacyClass .Values.ingress.className) -}}
    {{- fail "Traefik preview requires kubernetes.io/ingress.class to match the primary ingress.className; remove the conflicting legacy annotation" -}}
  {{- end -}}
  {{- if not (semverCompare ">=1.19-0" .Capabilities.KubeVersion.GitVersion) -}}{{- fail "Traefik migration requires Kubernetes >=1.19" -}}{{- end -}}
  {{- if not .Values.ingress.tls -}}{{- fail "Traefik requires existing ingress.tls certificate Secrets" -}}{{- end -}}
  {{- $known := list "nginx.ingress.kubernetes.io/proxy-body-size" "nginx.ingress.kubernetes.io/ssl-redirect" "nginx.ingress.kubernetes.io/cors-allow-origin" "nginx.ingress.kubernetes.io/enable-cors" -}}
  {{- range $key, $value := .Values.ingress.annotations -}}
    {{- if and (hasPrefix "nginx.ingress.kubernetes.io/" $key) (not (has $key $known)) -}}
      {{- fail (printf "Traefik migration needs an explicit replacement for annotation %s" $key) -}}
    {{- end -}}
  {{- end -}}
  {{- $origin := required "Traefik requires env.CORS_ORIGIN" .Values.env.CORS_ORIGIN -}}
  {{- if not (regexMatch "^https?://[^/?#* ,]+$" $origin) -}}{{- fail "env.CORS_ORIGIN must be one explicit HTTP(S) origin without a path or wildcard" -}}{{- end -}}
{{- end -}}
{{- end }}
