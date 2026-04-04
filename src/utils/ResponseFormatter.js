/**
 * FOODIO API - Response Formatter
 * Standardized API response format for all endpoints
 */

class ResponseFormatter {
    /**
     * Send success response
     * @param {Object} res - Express response object
     * @param {number} statusCode - HTTP status code
     * @param {string} message - Response message
     * @param {*} data - Response data
     * @param {number} count - Total count (for list endpoints)
     */
    static success(res, statusCode = 200, message = 'Success', data = null, count = null) {
        const response = {
            success: true,
            message,
            data,
        };

        if (count !== null) {
            response.count = count;
        }

        return res.status(statusCode).json(response);
    }

    /**
     * Send error response
     * @param {Object} res - Express response object
     * @param {number} statusCode - HTTP status code
     * @param {string} message - Error message
     * @param {Array} errors - Validation errors
     */
    static error(res, statusCode = 500, message = 'Error', errors = null) {
        const response = {
            success: false,
            message,
        };

        if (errors && Array.isArray(errors) && errors.length > 0) {
            response.errors = errors;
        }

        return res.status(statusCode).json(response);
    }

    /**
     * Send paginated response
     * @param {Object} res - Express response object
     * @param {number} statusCode - HTTP status code
     * @param {string} message - Response message
     * @param {Array} data - Array of items
     * @param {number} total - Total count
     * @param {number} page - Current page
     * @param {number} limit - Items per page
     */
    static paginated(res, statusCode = 200, message = 'Success', data = [], total = 0, page = 1, limit = 10) {
        const totalPages = Math.ceil(total / limit);
        
        return res.status(statusCode).json({
            success: true,
            message,
            data,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        });
    }
}

module.exports = ResponseFormatter;
