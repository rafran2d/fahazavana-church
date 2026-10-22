import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:drift/drift.dart' show Value;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../../core/api_client.dart';
import '../../core/providers.dart';
import '../../data/local/app_database.dart';

/// Téléchargement pour l'écoute offline : audio + segments (toutes langues disponibles).
/// Fichiers dans le stockage privé de l'application ; index dans Drift.
/// Évolution : background_downloader pour reprise après coupure et téléchargement Wi-Fi seul.
class DownloadService {
  DownloadService(this._api, this._db);

  final ApiClient _api;
  final AppDatabase _db;

  /// Dio sans intercepteur : une URL présignée S3 refuse tout en-tête Authorization.
  final Dio _plain = Dio();

  Future<void> download({required String churchId, required String sermonId}) async {
    final res = await _api.dio.get('/churches/$churchId/sermons/$sermonId/download');
    final bundle = res.data as Map<String, dynamic>;
    final sermon = bundle['sermon'] as Map<String, dynamic>;

    final root = await getApplicationDocumentsDirectory();
    final dir = Directory(p.join(root.path, 'sermons', sermonId));
    await dir.create(recursive: true);

    // Les URLs présignées pointent directement sur le stockage objet
    final audioPath = p.join(dir.path, 'audio.ogg');
    await _plain.download(bundle['audioUrl'] as String, audioPath);

    final segmentPaths = <String, String>{};
    for (final entry in (bundle['segments'] as Map<String, dynamic>).entries) {
      final path = p.join(dir.path, 'segments.${entry.key}.json');
      await _plain.download(entry.value as String, path);
      segmentPaths[entry.key] = path;
    }

    await _db.saveDownload(DownloadedSermonsCompanion.insert(
      id: sermonId,
      churchId: churchId,
      title: sermon['title'] as String,
      durationS: Value(sermon['durationS'] as int?),
      audioPath: audioPath,
      segmentPaths: jsonEncode(segmentPaths),
      downloadedAt: DateTime.now(),
    ));
  }

  Future<void> remove(DownloadedSermon s) async {
    final dir = Directory(p.dirname(s.audioPath));
    if (await dir.exists()) await dir.delete(recursive: true);
    await _db.removeDownload(s.id);
  }

  /// À la reconnexion : retire les contenus dont l'accès a été révoqué.
  Future<int> syncAccess() async {
    final local = await _db.watchDownloads().first;
    if (local.isEmpty) return 0;
    final res = await _api.dio
        .post('/me/downloads/check', data: {'sermonIds': local.map((s) => s.id).toList()});
    final revoked = ((res.data as Map)['revoked'] as List).cast<String>().toSet();
    for (final s in local.where((s) => revoked.contains(s.id))) {
      await remove(s);
    }
    return revoked.length;
  }

  /// Segments horodatés d'une langue, lus depuis le fichier local (aucun appel réseau).
  static Future<List<Map<String, dynamic>>> readSegments(DownloadedSermon s, String lang) async {
    final paths = (jsonDecode(s.segmentPaths) as Map).cast<String, String>();
    final path = paths[lang];
    if (path == null) return [];
    final json = jsonDecode(await File(path).readAsString()) as Map<String, dynamic>;
    return (json['segments'] as List).cast<Map<String, dynamic>>();
  }
}

final downloadServiceProvider = Provider<DownloadService>(
    (ref) => DownloadService(ref.watch(apiClientProvider), ref.watch(databaseProvider)));

final downloadsProvider =
    StreamProvider<List<DownloadedSermon>>((ref) => ref.watch(databaseProvider).watchDownloads());
