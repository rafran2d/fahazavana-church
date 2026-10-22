import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

import '../../data/local/app_database.dart';
import 'download_service.dart';

/// Lecture hors connexion avec sous-titres synchronisés sur la position audio.
/// Aucun appel réseau : audio et segments sont lus depuis le stockage local.
class OfflinePlayerScreen extends ConsumerStatefulWidget {
  const OfflinePlayerScreen({super.key, required this.sermonId});

  final String sermonId;

  @override
  ConsumerState<OfflinePlayerScreen> createState() => _OfflinePlayerScreenState();
}

class _OfflinePlayerScreenState extends ConsumerState<OfflinePlayerScreen> {
  final _player = AudioPlayer();
  DownloadedSermon? _sermon;
  List<String> _languages = [];
  String? _lang;
  List<Map<String, dynamic>> _segments = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final all = await ref.read(downloadsProvider.future);
    final s = all.firstWhere((d) => d.id == widget.sermonId);
    final langs = (jsonDecode(s.segmentPaths) as Map).keys.cast<String>().toList();
    await _player.setFilePath(s.audioPath);
    setState(() {
      _sermon = s;
      _languages = langs;
    });
    if (langs.isNotEmpty) await _selectLang(langs.first);
  }

  Future<void> _selectLang(String lang) async {
    final segments = await DownloadService.readSegments(_sermon!, lang);
    setState(() {
      _lang = lang;
      _segments = segments;
    });
  }

  String? _currentText(Duration position) {
    final ms = position.inMilliseconds;
    for (final s in _segments) {
      if (ms >= (s['startMs'] as int) && ms <= (s['endMs'] as int)) return s['text'] as String;
    }
    return null;
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = _sermon;
    return Scaffold(
      appBar: AppBar(title: Text(s?.title ?? '')),
      body: s == null
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Wrap(spacing: 8, children: [
                    for (final l in _languages)
                      ChoiceChip(
                        label: Text(l.toUpperCase()),
                        selected: l == _lang,
                        onSelected: (_) => _selectLang(l),
                      ),
                  ]),
                  Expanded(
                    child: Center(
                      child: StreamBuilder<Duration>(
                        stream: _player.positionStream,
                        builder: (_, snap) => Text(
                          _currentText(snap.data ?? Duration.zero) ?? '…',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                      ),
                    ),
                  ),
                  StreamBuilder<Duration>(
                    stream: _player.positionStream,
                    builder: (_, snap) {
                      final total = _player.duration ?? Duration.zero;
                      final pos = snap.data ?? Duration.zero;
                      return Slider(
                        max: total.inMilliseconds.toDouble().clamp(1, double.infinity),
                        value: pos.inMilliseconds.clamp(0, total.inMilliseconds).toDouble(),
                        onChanged: (v) => _player.seek(Duration(milliseconds: v.round())),
                      );
                    },
                  ),
                  StreamBuilder<bool>(
                    stream: _player.playingStream,
                    builder: (_, snap) {
                      final playing = snap.data ?? false;
                      return IconButton.filled(
                        iconSize: 48,
                        icon: Icon(playing ? Icons.pause : Icons.play_arrow),
                        onPressed: playing ? _player.pause : _player.play,
                      );
                    },
                  ),
                ],
              ),
            ),
    );
  }
}
