import 'dart:io';
import 'package:flutter_image_compress/flutter_image_compress.dart';

class ImageCompressionService {
  static final ImageCompressionService _instance = ImageCompressionService._internal();
  factory ImageCompressionService() => _instance;
  ImageCompressionService._internal();

  /// Compresses the given file using flutter_image_compress.
  /// Enforces: Max width/height 1280px, format JPEG, quality 70%.
  Future<File> compressImage(File file) async {
    try {
      final sizeBefore = await file.length();
      if (sizeBefore < 250 * 1024) {
        // Already under target size, skip compression
        return file;
      }

      final parentPath = file.parent.path;
      final targetPath = '$parentPath/compressed_${DateTime.now().millisecondsSinceEpoch}.jpg';

      final result = await FlutterImageCompress.compressAndGetFile(
        file.absolute.path,
        targetPath,
        quality: 70,
        minWidth: 1280,
        minHeight: 1280,
        format: CompressFormat.jpeg,
      );

      if (result == null) {
        return file;
      }

      final compressedFile = File(result.path);
      final sizeAfter = await compressedFile.length();
      print('[ImageCompress] Compressed from ${sizeBefore / 1024} KB to ${sizeAfter / 1024} KB');
      return compressedFile;
    } catch (e) {
      print('[ImageCompress] Error during image compression: $e');
      return file; // Fallback to original file
    }
  }
}
