/// Utilisateur connecté et son éventuel rattachement à une église (staff).
class Session {
  Session({
    required this.userId,
    required this.name,
    required this.email,
    required this.platformRole,
    this.staffChurchId,
    this.staffChurchName,
    this.staffRole,
  });

  factory Session.fromJson(Map<String, dynamic> json) {
    final staff = json['staff'] as Map<String, dynamic>?;
    return Session(
      userId: json['id'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
      platformRole: json['platformRole'] as String,
      staffChurchId: staff?['churchId'] as String?,
      staffChurchName: (staff?['church'] as Map<String, dynamic>?)?['name'] as String?,
      staffRole: staff?['role'] as String?,
    );
  }

  final String userId;
  final String name;
  final String email;
  final String platformRole;
  final String? staffChurchId;
  final String? staffChurchName;
  final String? staffRole;

  bool get isPreacher => staffRole == 'PREACHER';
  bool get isChurchAdmin => staffRole == 'ADMIN';
  bool get isSuperAdmin => platformRole == 'SUPER_ADMIN';
}
