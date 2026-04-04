/**
 * FOODIO API - File Upload Middleware
 * Production-ready file upload handling with validation and error handling
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');
const Logger = require('../utils/Logger');

const logger = new Logger('FileUpload');

// Create upload directory if it doesn't exist
if (!fs.existsSync(config.upload.uploadDir)) {
    fs.mkdirSync(config.upload.uploadDir, { recursive: true });
}

/**
 * Storage configuration
 */
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, config.upload.uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        const filename = `${name}-${uniqueSuffix}${ext}`;
        
        logger.debug('File upload', { 
            originalName: file.originalname, 
            newName: filename,
            mimetype: file.mimetype 
        });
        
        cb(null, filename);
    }
});

/**
 * File filter for validation
 */
const fileFilter = (req, file, cb) => {
    // Allowed MIME types
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    
    // Check MIME type
    if (!allowedTypes.includes(file.mimetype)) {
        logger.warn('Unsupported file type', { 
            mimetype: file.mimetype,
            filename: file.originalname 
        });
        const error = new Error(`Unsupported file type: ${file.mimetype}`);
        error.statusCode = 400;
        return cb(error, false);
    }

    cb(null, true);
};

/**
 * Create multer upload instance
 */
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: config.upload.maxFileSize,
    },
    onError: (error, next) => {
        logger.error('Multer error', { error: error.message });
        next(error);
    }
});

/**
 * Error handling middleware for file uploads
 */
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'FILE_TOO_LARGE') {
            logger.warn('File too large', { 
                size: err.limit,
                field: err.field 
            });
            return res.status(413).json({
                success: false,
                message: `File size exceeds ${config.upload.maxFileSize / (1024 * 1024)}MB limit`
            });
        }

        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Too many files'
            });
        }

        logger.error('Multer error', { 
            code: err.code,
            message: err.message 
        });
        return res.status(400).json({
            success: false,
            message: err.message
        });
    } else if (err) {
        logger.error('Upload error', { error: err.message });
        return res.status(400).json({
            success: false,
            message: err.message || 'File upload failed'
        });
    }

    next();
};

/**
 * Delete uploaded file
 */
const deleteFile = (filePath) => {
    try {
        const fullPath = path.join(config.upload.uploadDir, filePath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            logger.info('File deleted', { filePath });
            return true;
        }
        return false;
    } catch (error) {
        logger.error('File deletion error', { filePath, error: error.message });
        return false;
    }
};

module.exports = {
    upload,
    handleUploadError,
    deleteFile,
};