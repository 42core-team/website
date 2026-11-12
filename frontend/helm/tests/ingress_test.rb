#!/usr/bin/env ruby
# Render the real chart using Ruby's bundled YAML and test libraries.
require 'minitest/autorun'
require 'open3'
require 'yaml'

class FrontendIngressTest < Minitest::Test
  CHART = File.expand_path('..', __dir__)

  def render(environment = nil, *options, release: nil)
    release ||= environment == 'prod' ? 'frontend-main' : 'frontend-dev'
    namespace = environment == 'prod' ? 'production' : 'development'
    args = ['helm', 'template', release, CHART, '--namespace', namespace, '--kube-version', '1.36.5']
    args += ['-f', File.join(CHART, "values-#{environment}.yaml")] if environment
    output, error, status = Open3.capture3(*args, *options)
    [status, output, error]
  end

  def resources(environment = nil, *options, **kwargs)
    status, output, error = render(environment, *options, **kwargs)
    assert status.success?, error
    YAML.load_stream(output).compact
  end

  def test_default_class_is_traefik_and_public_routes_are_disabled_without_environment
    values = YAML.load_file(File.join(CHART, 'values.yaml'))
    assert_equal 'traefik', values.dig('ingress', 'className')
    assert_equal 'traefik', values.dig('ingressRedirect', 'className')
    refute resources.any? { |r| ['Ingress', 'Middleware'].include?(r['kind']) }
  end

  def test_environment_routes_have_only_expected_hosts_backends_and_existing_tls
    expected = {
      'dev' => { 'frontend-dev' => ['dev.coregame.sh', 'dev-coregame-de-tls'] },
      'prod' => {
        'frontend-main' => ['coregame.sh', 'coregame-de-tls'],
        'frontend-main-redirect' => ['www.coregame.sh', 'www-coregame-de-tls']
      }
    }
    expected.each do |environment, routes|
      all = resources(environment)
      ingresses = all.select { |r| r['kind'] == 'Ingress' }
      assert_equal routes.keys.sort, ingresses.map { |r| r.dig('metadata', 'name') }.sort
      ingresses.each do |route|
        name = route.dig('metadata', 'name')
        host, secret = routes.fetch(name)
        assert_equal 'networking.k8s.io/v1', route['apiVersion']
        assert_equal 'traefik', route.dig('spec', 'ingressClassName')
        assert_equal host, route.dig('spec', 'rules', 0, 'host')
        assert_equal [{ 'hosts' => [host], 'secretName' => secret }], route.dig('spec', 'tls')
        backend = route.dig('spec', 'rules', 0, 'http', 'paths', 0, 'backend', 'service')
        assert_equal({ 'name' => environment == 'prod' ? 'frontend-main' : 'frontend-dev', 'port' => { 'number' => 3000 } }, backend)
        annotations = route.dig('metadata', 'annotations')
        assert_equal 'letsencrypt-prod', annotations['cert-manager.io/cluster-issuer']
        assert_equal 'websecure', annotations['traefik.ingress.kubernetes.io/router.entrypoints']
        assert_equal 'true', annotations['traefik.ingress.kubernetes.io/router.tls']
        refute annotations.keys.any? { |key| key.start_with?('nginx.') || key == 'kubernetes.io/ingress.class' }
      end
      assert_equal environment == 'prod' ? 1 : 0, all.count { |r| r['kind'] == 'Middleware' }
    end
  end

  def test_www_redirect_is_same_namespace_native_middleware_with_fixed_destination
    all = resources('prod')
    redirect = all.find { |r| r['kind'] == 'Ingress' && r.dig('metadata', 'name') == 'frontend-main-redirect' }
    middleware = all.find { |r| r['kind'] == 'Middleware' }
    assert_equal 'traefik.io/v1alpha1', middleware['apiVersion']
    assert_equal "production-#{middleware.dig('metadata', 'name')}@kubernetescrd", redirect.dig('metadata', 'annotations', 'traefik.ingress.kubernetes.io/router.middlewares')
    configuration = middleware.dig('spec', 'redirectRegex')
    assert_equal true, configuration['permanent']
    assert_equal 'https://coregame.sh', configuration['replacement']
    regex = Regexp.new(configuration['regex'])
    assert_match regex, 'https://www.coregame.sh/a/path?test=1'
    assert_match regex, 'http://www.coregame.sh:80/a'
    assert_match regex, 'https://WWW.COREGAME.SH/a'
    refute_match regex, 'https://wwwXcoregameXsh/a'
    refute_match regex, 'https://www.coregame.sh.attacker.example/a'
    assert_equal 'https://coregame.sh', 'https://www.coregame.sh/a/path?test=1'.sub(regex, configuration['replacement'])
  end

  def test_long_release_names_keep_middleware_names_unique_and_valid
    names = %w[a b].map do |suffix|
      release = 'frontend-' + ('x' * 43) + suffix
      all = resources('prod', release: release)
      middleware = all.find { |r| r['kind'] == 'Middleware' }
      name = middleware.dig('metadata', 'name')
      assert_operator name.length, :<=, 63
      redirect = all.find { |r| r['kind'] == 'Ingress' && r.dig('metadata', 'name').end_with?('-redirect') }
      assert_equal "production-#{name}@kubernetescrd", redirect.dig('metadata', 'annotations', 'traefik.ingress.kubernetes.io/router.middlewares')
      name
    end
    refute_equal names[0], names[1]
  end

  def test_disabled_optional_www_redirect_creates_no_middleware_or_extra_ingress
    all = resources('prod', '--set', 'ingressRedirect.enabled=false')
    assert_equal 1, all.count { |r| r['kind'] == 'Ingress' }
    refute all.any? { |r| r['kind'] == 'Middleware' }
  end

  def test_redirect_requires_existing_tls_and_valid_hostnames
    ['ingressRedirect.tls.enabled=false', 'ingressRedirect.tls.secretName=', 'ingressRedirect.toHost=https://attacker.example/path', 'ingressRedirect.fromHost=www.coregame.sh/extra', 'ingressRedirect.fromHost=a..b', 'ingressRedirect.toHost=-invalid.example'].each do |setting|
      status, _, error = render('prod', '--set', setting)
      refute status.success?
      assert_match(/required|must be/, error)
    end
  end

  def test_redirect_rejects_identical_source_and_destination_ignoring_case
    ['coregame.sh', 'COREGAME.SH'].each do |host|
      status, _, error = render('prod', '--set', "ingressRedirect.fromHost=#{host}")
      refute status.success?
      assert_match(/must be different to avoid a redirect loop/, error)
    end
  end

  def test_enabled_ingress_requires_nonempty_host_configuration
    [['--set-json', 'ingress.hosts=[]'], ['--set', 'ingress.hosts[0].host=']].each do |options|
      status, _, error = render('dev', *options)
      refute status.success?
      assert_match(/ingress.hosts.*must contain at least one host|ingress.hosts.*host is required/, error)
    end
  end

  def test_public_ingress_requires_tls_secret
    [['--set-json', 'ingress.tls=[]'], ['--set', 'ingress.tls[0].secretName=']].each do |options|
      status, _, error = render('dev', *options)
      refute status.success?
      assert_match(/must reference|required/, error)
    end
  end
end
