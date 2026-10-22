import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/providers.dart';

class ChurchSummary {
  ChurchSummary({required this.id, required this.name, this.description});

  factory ChurchSummary.fromJson(Map<String, dynamic> json) => ChurchSummary(
        id: json['id'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
      );

  final String id;
  final String name;
  final String? description;
}

class ActiveLive {
  ActiveLive({required this.id, required this.title, required this.preacherName});

  factory ActiveLive.fromJson(Map<String, dynamic> json) => ActiveLive(
        id: json['id'] as String,
        title: json['title'] as String,
        preacherName: ((json['preacher'] as Map)['user'] as Map)['name'] as String,
      );

  final String id;
  final String title;
  final String preacherName;
}

class ChurchesRepository {
  ChurchesRepository(this._api);
  final ApiClient _api;

  Future<List<ChurchSummary>> search(String query) async {
    final res = await _api.dio.get('/churches', queryParameters: {if (query.isNotEmpty) 'q': query});
    return (res.data as List).map((e) => ChurchSummary.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<ChurchSummary>> followed() async {
    final res = await _api.dio.get('/me/memberships');
    return (res.data as List)
        .map((e) => ChurchSummary.fromJson((e as Map<String, dynamic>)['church'] as Map<String, dynamic>))
        .toList();
  }

  Future<void> follow(String churchId) => _api.dio.post('/churches/$churchId/follow');

  Future<void> unfollow(String churchId) => _api.dio.delete('/churches/$churchId/follow');

  Future<List<ActiveLive>> activeLives(String churchId) async {
    final res = await _api.dio.get('/churches/$churchId/lives/active');
    return (res.data as List).map((e) => ActiveLive.fromJson(e as Map<String, dynamic>)).toList();
  }
}

final churchesRepositoryProvider =
    Provider<ChurchesRepository>((ref) => ChurchesRepository(ref.watch(apiClientProvider)));

final followedChurchesProvider = FutureProvider.autoDispose<List<ChurchSummary>>(
    (ref) => ref.watch(churchesRepositoryProvider).followed());

final activeLivesProvider = FutureProvider.autoDispose.family<List<ActiveLive>, String>(
    (ref, churchId) => ref.watch(churchesRepositoryProvider).activeLives(churchId));
