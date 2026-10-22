import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/providers.dart';

class LiveConnection {
  LiveConnection({
    required this.liveId,
    required this.wsUrl,
    required this.token,
    this.sermonId,
    this.languages = const [],
  });

  final String liveId;
  final String wsUrl;
  final String token;
  final String? sermonId;
  final List<String> languages;
}

class LiveRepository {
  LiveRepository(this._api);
  final ApiClient _api;

  /// Prédicateur : crée le live et récupère un jeton émetteur.
  Future<LiveConnection> start(String churchId, String title) async {
    final res = await _api.dio.post('/churches/$churchId/lives', data: {'title': title});
    final d = res.data as Map<String, dynamic>;
    return LiveConnection(liveId: d['liveId'], wsUrl: d['wsUrl'], token: d['token']);
  }

  Future<void> stop(String churchId, String liveId) =>
      _api.dio.post('/churches/$churchId/lives/$liveId/stop');

  /// Membre : jeton spectateur + langues disponibles.
  Future<LiveConnection> join(String churchId, String liveId) async {
    final res = await _api.dio.post('/churches/$churchId/lives/$liveId/join');
    final d = res.data as Map<String, dynamic>;
    return LiveConnection(
      liveId: d['liveId'],
      wsUrl: d['wsUrl'],
      token: d['token'],
      sermonId: d['sermonId'] as String?,
      languages: (d['languages'] as List).cast<String>(),
    );
  }
}

final liveRepositoryProvider =
    Provider<LiveRepository>((ref) => LiveRepository(ref.watch(apiClientProvider)));
