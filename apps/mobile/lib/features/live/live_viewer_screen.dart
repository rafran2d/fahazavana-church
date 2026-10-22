import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:livekit_client/livekit_client.dart';

import '../../core/api_client.dart';
import 'live_repository.dart';
import 'subtitle_message.dart';

/// Écran spectateur : écoute du live + sous-titres dans la langue choisie.
/// Changer de langue ne coupe pas l'audio : seul le filtrage d'affichage change.
class LiveViewerScreen extends ConsumerStatefulWidget {
  const LiveViewerScreen({super.key, required this.churchId, required this.liveId});

  final String churchId;
  final String liveId;

  @override
  ConsumerState<LiveViewerScreen> createState() => _LiveViewerScreenState();
}

class _LiveViewerScreenState extends ConsumerState<LiveViewerScreen> {
  final _room = Room(roomOptions: const RoomOptions(adaptiveStream: true, dynacast: true));
  EventsListener<RoomEvent>? _listener;
  final _subtitles = <SubtitleMessage>[];
  List<String> _languages = [];
  String? _lang;
  String? _error;
  bool _connected = false;

  @override
  void initState() {
    super.initState();
    _connect();
  }

  Future<void> _connect() async {
    try {
      final conn = await ref.read(liveRepositoryProvider).join(widget.churchId, widget.liveId);
      _listener = _room.createListener()
        ..on<DataReceivedEvent>((event) {
          if (event.topic != 'subtitles') return;
          final msg = SubtitleMessage.tryParse(event.data);
          if (msg == null || !mounted) return;
          setState(() {
            _subtitles.add(msg);
            // On garde un historique borné en mémoire
            if (_subtitles.length > 400) _subtitles.removeRange(0, 100);
          });
        })
        ..on<RoomDisconnectedEvent>((_) {
          if (mounted) setState(() => _connected = false);
        });
      // L'audio distant est lu automatiquement par le SDK dès l'abonnement
      await _room.connect(conn.wsUrl, conn.token);
      setState(() {
        _connected = true;
        _languages = conn.languages;
        _lang = conn.languages.length > 1 ? conn.languages[1] : conn.languages.firstOrNull;
      });
    } catch (e) {
      setState(() => _error = apiErrorMessage(e));
    }
  }

  @override
  void dispose() {
    _listener?.dispose();
    _room.disconnect();
    _room.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final visible = _subtitles.where((s) => s.lang == _lang).toList().reversed.toList();
    return Scaffold(
      appBar: AppBar(
        title: Row(children: [
          Icon(Icons.circle, size: 12, color: _connected ? Colors.red : Colors.grey),
          const SizedBox(width: 8),
          Text(_connected ? 'En direct' : 'Connexion…'),
        ]),
      ),
      body: _error != null
          ? Center(child: Text(_error!))
          : Column(
              children: [
                if (_languages.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Wrap(
                      spacing: 8,
                      children: [
                        for (final l in _languages)
                          ChoiceChip(
                            label: Text(l.toUpperCase()),
                            selected: l == _lang,
                            onSelected: (_) => setState(() => _lang = l),
                          ),
                      ],
                    ),
                  ),
                Expanded(
                  child: visible.isEmpty
                      ? const Center(child: Text('Les sous-titres apparaîtront ici.'))
                      : ListView.builder(
                          reverse: true,
                          padding: const EdgeInsets.all(16),
                          itemCount: visible.length,
                          itemBuilder: (_, i) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Text(
                              visible[i].text,
                              style: i == 0
                                  ? Theme.of(context).textTheme.titleLarge
                                  : Theme.of(context).textTheme.bodyLarge,
                            ),
                          ),
                        ),
                ),
              ],
            ),
    );
  }
}
