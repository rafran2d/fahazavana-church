import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

part 'app_database.g.dart';

/// Prédications disponibles hors connexion.
class DownloadedSermons extends Table {
  TextColumn get id => text()();
  TextColumn get churchId => text()();
  TextColumn get title => text()();
  IntColumn get durationS => integer().nullable()();
  TextColumn get audioPath => text()();
  /// JSON {"fr": "/chemin/segments.fr.json", "en": "..."}
  TextColumn get segmentPaths => text()();
  DateTimeColumn get downloadedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

@DriftDatabase(tables: [DownloadedSermons])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_open());

  @override
  int get schemaVersion => 1;

  Stream<List<DownloadedSermon>> watchDownloads() =>
      (select(downloadedSermons)..orderBy([(t) => OrderingTerm.desc(t.downloadedAt)])).watch();

  Future<void> saveDownload(DownloadedSermonsCompanion entry) =>
      into(downloadedSermons).insertOnConflictUpdate(entry);

  Future<void> removeDownload(String id) =>
      (delete(downloadedSermons)..where((t) => t.id.equals(id))).go();
}

LazyDatabase _open() => LazyDatabase(() async {
      final dir = await getApplicationDocumentsDirectory();
      return NativeDatabase.createInBackground(File(p.join(dir.path, 'fahazavana.sqlite')));
    });
