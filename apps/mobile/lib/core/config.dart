/// Configuration injectée à la compilation : --dart-define=API_URL=...
class AppConfig {
  static const apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:3000/api/v1', // émulateur Android → machine hôte
  );
}
