import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Jeton d'accès en mémoire, refresh token chiffré par le système (Keystore / Keychain).
class TokenStore {
  TokenStore([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();

  static const _refreshKey = 'refresh_token';
  final FlutterSecureStorage _storage;
  String? accessToken;

  Future<String?> readRefreshToken() => _storage.read(key: _refreshKey);

  Future<void> save({required String accessToken, required String refreshToken}) async {
    this.accessToken = accessToken;
    await _storage.write(key: _refreshKey, value: refreshToken);
  }

  Future<void> clear() async {
    accessToken = null;
    await _storage.delete(key: _refreshKey);
  }
}
