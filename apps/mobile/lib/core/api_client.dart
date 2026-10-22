import 'dart:async';

import 'package:dio/dio.dart';

import 'config.dart';
import 'token_store.dart';

/// Client HTTP : ajoute le jeton d'accès et le renouvelle automatiquement sur 401.
class ApiClient {
  ApiClient(this._tokens, {void Function()? onSessionExpired})
      : _onSessionExpired = onSessionExpired,
        dio = Dio(BaseOptions(
          baseUrl: AppConfig.apiUrl,
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 20),
        )) {
    dio.interceptors.add(QueuedInterceptorsWrapper(
      onRequest: (options, handler) {
        final token = _tokens.accessToken;
        if (token != null) options.headers['Authorization'] = 'Bearer $token';
        handler.next(options);
      },
      onError: (error, handler) async {
        final isAuthCall = error.requestOptions.path.startsWith('/auth/');
        if (error.response?.statusCode != 401 || isAuthCall) return handler.next(error);
        if (await _refresh()) {
          final retry = error.requestOptions
            ..headers['Authorization'] = 'Bearer ${_tokens.accessToken}';
          return handler.resolve(await dio.fetch(retry));
        }
        _onSessionExpired?.call();
        handler.next(error);
      },
    ));
  }

  final Dio dio;
  final TokenStore _tokens;
  final void Function()? _onSessionExpired;

  Future<bool> _refresh() async {
    final refreshToken = await _tokens.readRefreshToken();
    if (refreshToken == null) return false;
    try {
      // Dio séparé : évite de repasser par l'intercepteur pendant le renouvellement
      final res = await Dio(BaseOptions(baseUrl: AppConfig.apiUrl))
          .post('/auth/refresh', data: {'refreshToken': refreshToken});
      await _tokens.save(
        accessToken: res.data['accessToken'] as String,
        refreshToken: res.data['refreshToken'] as String,
      );
      return true;
    } on DioException {
      await _tokens.clear();
      return false;
    }
  }
}

/// Message lisible à partir d'une erreur RFC 7807 renvoyée par l'API.
String apiErrorMessage(Object error) {
  if (error is DioException) {
    final detail = error.response?.data is Map ? error.response?.data['detail'] : null;
    if (detail is String) return detail;
    if (detail is List && detail.isNotEmpty) return detail.join('\n');
    if (error.type == DioExceptionType.connectionError) return 'Serveur injoignable';
  }
  return 'Une erreur est survenue';
}
