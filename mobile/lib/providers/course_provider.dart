import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../models/course.dart';

class CourseProvider with ChangeNotifier {
  List<Course> _courses = [];
  bool _isLoading = false;
  final String baseUrl = 'http://10.0.2.2:5000/api'; // Use 10.0.2.2 for Android Emulator

  List<Course> get courses => [..._courses];
  bool get isLoading => _isLoading;

  Future<void> fetchCourses() async {
    _isLoading = true;
    notifyListeners();
    try {
      final response = await http.get(Uri.parse('$baseUrl/courses'));
      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        _courses = data.map((item) => Course.fromMap(item, item['id'].toString())).toList();
      }
    } catch (e) {
      print('Error fetching courses: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> addCourse(String name, String instructor, int students) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/courses'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'name': name,
          'instructor': instructor,
          'students': students,
          'status': 'Active'
        }),
      );
      if (response.statusCode == 201) {
        await fetchCourses();
        return true;
      }
    } catch (e) {
      print('Error adding course: $e');
    }
    return false;
  }

  Future<bool> deleteCourse(String id) async {
    try {
      final response = await http.delete(Uri.parse('$baseUrl/courses/$id'));
      if (response.statusCode == 200) {
        _courses.removeWhere((c) => c.id == id);
        notifyListeners();
        return true;
      }
    } catch (e) {
      print('Error deleting course: $e');
    }
    return false;
  }
}
