class Course {
  final String id;
  final String name;
  final String instructor;
  final int students;
  final String status;

  Course({
    required this.id,
    required this.name,
    required this.instructor,
    required this.students,
    required this.status,
  });

  factory Course.fromMap(Map<String, dynamic> data, String id) {
    return Course(
      id: id,
      name: data['name'] ?? '',
      instructor: data['instructor'] ?? '',
      students: data['students'] ?? 0,
      status: data['status'] ?? 'Active',
    );
  }
}
