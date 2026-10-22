import 'dart:convert';

/// Message publié par le worker IA sur le topic `subtitles` (voir apps/ai-worker/README.md).
class SubtitleMessage {
  SubtitleMessage({
    required this.seq,
    required this.startMs,
    required this.endMs,
    required this.lang,
    required this.text,
  });

  static SubtitleMessage? tryParse(List<int> bytes) {
    try {
      final json = jsonDecode(utf8.decode(bytes)) as Map<String, dynamic>;
      return SubtitleMessage(
        seq: json['seq'] as int,
        startMs: json['startMs'] as int,
        endMs: json['endMs'] as int,
        lang: json['lang'] as String,
        text: json['text'] as String,
      );
    } catch (_) {
      return null;
    }
  }

  final int seq;
  final int startMs;
  final int endMs;
  final String lang;
  final String text;
}
