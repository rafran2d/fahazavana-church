import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import 'session.dart';

final authControllerProvider =
    AsyncNotifierProvider<AuthController, Session?>(AuthController.new);

class AuthController extends AsyncNotifier<Session?> {
  @override
  Future<Session?> build() async {
    // Reprise de session au démarrage grâce au refresh token stocké
    final tokens = ref.read(tokenStoreProvider);
    final refresh = await tokens.readRefreshToken();
    if (refresh == null) return null;
    try {
      final res = await ref
          .read(apiClientProvider)
          .dio
          .post('/auth/refresh', data: {'refreshToken': refresh});
      return _store(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      // Hors connexion : on garde le refresh token pour la prochaine ouverture
      if (e.response == null) return null;
      await tokens.clear();
      return null;
    }
  }

  Future<void> login(String email, String password) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final res = await ref
          .read(apiClientProvider)
          .dio
          .post('/auth/login', data: {'email': email, 'password': password});
      return _store(res.data as Map<String, dynamic>);
    });
  }

  Future<void> register(String name, String email, String password) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final res = await ref
          .read(apiClientProvider)
          .dio
          .post('/auth/register', data: {'name': name, 'email': email, 'password': password});
      return _store(res.data as Map<String, dynamic>);
    });
  }

  Future<void> logout() async {
    final tokens = ref.read(tokenStoreProvider);
    final refresh = await tokens.readRefreshToken();
    if (refresh != null) {
      try {
        await ref.read(apiClientProvider).dio.post('/auth/logout', data: {'refreshToken': refresh});
      } catch (_) {/* déconnexion locale quoi qu'il arrive */}
    }
    await tokens.clear();
    state = const AsyncData(null);
  }

  Future<Session> _store(Map<String, dynamic> data) async {
    await ref.read(tokenStoreProvider).save(
          accessToken: data['accessToken'] as String,
          refreshToken: data['refreshToken'] as String,
        );
    // TODO S7 : enregistrer le jeton FCM via POST /me/devices
    return Session.fromJson(data['user'] as Map<String, dynamic>);
  }
}
