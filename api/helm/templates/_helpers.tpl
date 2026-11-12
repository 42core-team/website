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

{{/* Attach the API security chain to every enabled ingress. */}}
{{- define "api.ingressAnnotations" -}}
{{- $annotations := deepCopy .Values.ingress.annotations -}}
{{- $_ := set $annotations "traefik.ingress.kubernetes.io/router.entrypoints" "websecure" -}}
{{- $_ := set $annotations "traefik.ingress.kubernetes.io/router.tls" "true" -}}
{{- $headers := include "api.traefikName" (dict "root" . "suffix" "cors") -}}
{{- $buffer := include "api.traefikName" (dict "root" . "suffix" "upload-limit") -}}
{{- $chain := printf "%s-%s@kubernetescrd,%s-%s@kubernetescrd" .Release.Namespace $headers .Release.Namespace $buffer -}}
{{- with index $annotations "traefik.ingress.kubernetes.io/router.middlewares" -}}
{{- $chain = printf "%s,%s" $chain . -}}
{{- end -}}
{{- $_ := set $annotations "traefik.ingress.kubernetes.io/router.middlewares" $chain -}}
{{- toYaml $annotations -}}
{{- end }}

{{- define "api.validateIngress" -}}
{{- if .Values.ingress.enabled -}}
  {{- if not .Values.ingress.tls -}}{{- fail "API ingress requires ingress.tls certificate Secrets" -}}{{- end -}}
  {{- range $key, $value := .Values.ingress.annotations -}}
    {{- if or (hasPrefix "nginx.ingress.kubernetes.io/" $key) (eq $key "kubernetes.io/ingress.class") -}}
      {{- fail (printf "API ingress uses native Traefik settings; remove unsupported annotation %s" $key) -}}
    {{- end -}}
  {{- end -}}
  {{- $origin := required "API ingress requires env.CORS_ORIGIN" .Values.env.CORS_ORIGIN -}}
  {{- if not (regexMatch "^https?://[^/?#* ,]+$" $origin) -}}{{- fail "env.CORS_ORIGIN must be one explicit HTTP(S) origin without a path or wildcard" -}}{{- end -}}
{{- end -}}
{{- end }}
