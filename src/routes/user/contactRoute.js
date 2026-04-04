/**
 * @file contact.js
 * @description Contact form management routes
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

const { authenticateToken, authorizeAdmin } = require('../../middleware/Auth');
const { asyncHandler } = require('../../middleware/ErrorHandler');
const ResponseFormatter = require('../../utils/ResponseFormatter');
const Validator = require('../../utils/Validator');
const ContactService = require('../../services/ContactService');
const Logger = require('../../utils/Logger');

const logger = new Logger('ContactRoute');

/**
 * POST /api/contact/submit
 * @description Submit a contact form
 * @body {string} name - Sender's name
 * @body {string} email - Sender's email
 * @body {string} phone - Sender's phone number
 * @body {string} subject - Subject of inquiry
 * @body {string} message - Message content
 * @returns {Object} Submitted contact form
 * @access Public
 */
router.post('/submit', asyncHandler(async (req, res) => {
    const { name, email, phone, subject, message } = req.body;

    // Validate inputs
    const errors = [];
    if (!Validator.isValidName(name)) {
        errors.push('Name must be between 2 and 100 characters');
    }
    if (!Validator.isValidEmail(email)) {
        errors.push('Valid email address is required');
    }
    if (!Validator.isValidPhone(phone)) {
        errors.push('Valid phone number is required (10+ digits)');
    }
    if (!subject || !Validator.sanitizeString(subject) || subject.length < 3) {
        errors.push('Subject must be at least 3 characters');
    }
    if (!message || !Validator.sanitizeString(message) || message.length < 10) {
        errors.push('Message must be at least 10 characters');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const formData = {
            name: Validator.sanitizeString(name),
            email: Validator.sanitizeString(email),
            phone,
            subject: Validator.sanitizeString(subject),
            message: Validator.sanitizeString(message)
        };

        const result = await ContactService.submitContactForm(formData);
        logger.info('Contact form submitted', { email, subject });

        return ResponseFormatter.success(res, 201, 'Thank you! Your message has been submitted successfully', result);
    } catch (error) {
        logger.error('Error submitting contact form', { email, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/admin/contact/submissions
 * @description Get all contact form submissions (admin only)
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20)
 * @query {string} status - Filter by status (optional)
 * @returns {Array} List of contact form submissions
 * @access Private (Admin only)
 * @requires authenticateToken, authorizeAdmin middleware
 */
router.get('/admin/submissions', authenticateToken, authorizeAdmin, asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;

    // Validate inputs
    const errors = [];

    const paginationErrors = Validator.validatePagination(page, limit);
    if (paginationErrors.length > 0) {
        errors.push(...paginationErrors);
    }

    if (status && !['new', 'in-progress', 'resolved', 'closed'].includes(status.toLowerCase())) {
        errors.push('Invalid status filter');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const result = await ContactService.getAllSubmissions(
            parseInt(page),
            parseInt(limit),
            status ? status.toLowerCase() : null
        );
        logger.info('Submissions retrieved', { page, limit, status, count: result.submissions.length });

        return ResponseFormatter.paginated(
            res, 200, 'Submissions retrieved successfully',
            result.submissions, result.total, page, limit
        );
    } catch (error) {
        logger.error('Error retrieving submissions', { error: error.message });
        throw error;
    }
}));

/**
 * GET /api/admin/contact/submission/:id
 * @description Get a specific contact form submission (admin only)
 * @param {string} id - Submission ID
 * @returns {Object} Contact form submission details
 * @access Private (Admin only)
 * @requires authenticateToken, authorizeAdmin middleware
 */
router.get('/admin/submission/:id', authenticateToken, authorizeAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Validate ID
    if (!Validator.isPositiveNumber(parseInt(id))) {
        return ResponseFormatter.error(res, 400, 'Invalid submission ID', ['Submission ID must be a positive number']);
    }

    try {
        const submission = await ContactService.getSubmissionById(parseInt(id));

        if (!submission) {
            return ResponseFormatter.error(res, 404, 'Submission not found');
        }

        logger.info('Submission details retrieved', { id });
        return ResponseFormatter.success(res, 200, 'Submission retrieved successfully', submission);
    } catch (error) {
        logger.error('Error retrieving submission', { id, error: error.message });
        throw error;
    }
}));

/**
 * PUT /api/admin/contact/submission/:id/status
 * @description Update contact form status (admin only)
 * @param {string} id - Submission ID
 * @body {string} status - New status (new, in-progress, resolved, closed)
 * @returns {Object} Updated submission
 * @access Private (Admin only)
 * @requires authenticateToken, authorizeAdmin middleware
 */
router.put('/admin/submission/:id/status', authenticateToken, authorizeAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    // Validate inputs
    const errors = [];
    if (!Validator.isPositiveNumber(parseInt(id))) {
        errors.push('Submission ID must be a positive number');
    }
    if (!status || !['new', 'in-progress', 'resolved', 'closed'].includes(status.toLowerCase())) {
        errors.push('Status must be one of: new, in-progress, resolved, closed');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const submission = await ContactService.updateSubmissionStatus(parseInt(id), status.toLowerCase());
        logger.info('Submission status updated', { id, status: status.toLowerCase() });

        return ResponseFormatter.success(res, 200, 'Status updated successfully', submission);
    } catch (error) {
        if (error.message.includes('not found')) {
            return ResponseFormatter.error(res, 404, 'Submission not found');
        }
        logger.error('Error updating submission status', { id, error: error.message });
        throw error;
    }
}));

/**
 * POST /api/admin/contact/submission/:id/reply
 * @description Add a reply to a contact form (admin only)
 * @param {string} id - Submission ID
 * @body {string} replyMessage - Reply message
 * @returns {Object} Updated submission with reply
 * @access Private (Admin only)
 * @requires authenticateToken, authorizeAdmin middleware
 */
router.post('/admin/submission/:id/reply', authenticateToken, authorizeAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { replyMessage } = req.body;

    // Validate inputs
    const errors = [];
    if (!Validator.isPositiveNumber(parseInt(id))) {
        errors.push('Submission ID must be a positive number');
    }
    if (!replyMessage || !Validator.sanitizeString(replyMessage) || replyMessage.length < 5) {
        errors.push('Reply message must be at least 5 characters');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const submission = await ContactService.addReply(parseInt(id), Validator.sanitizeString(replyMessage));
        logger.info('Reply added to submission', { id, repliedBy: req.user.id });

        return ResponseFormatter.success(res, 201, 'Reply added successfully', submission);
    } catch (error) {
        if (error.message.includes('not found')) {
            return ResponseFormatter.error(res, 404, 'Submission not found');
        }
        logger.error('Error adding reply', { id, error: error.message });
        throw error;
    }
}));

/**
 * DELETE /api/admin/contact/submission/:id
 * @description Delete a contact form submission (admin only)
 * @param {string} id - Submission ID
 * @returns {Object} Confirmation message
 * @access Private (Admin only)
 * @requires authenticateToken, authorizeAdmin middleware
 */
router.delete('/admin/submission/:id', authenticateToken, authorizeAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Validate ID
    if (!Validator.isPositiveNumber(parseInt(id))) {
        return ResponseFormatter.error(res, 400, 'Invalid submission ID', ['Submission ID must be a positive number']);
    }

    try {
        await ContactService.deleteSubmission(parseInt(id));
        logger.info('Submission deleted', { id, deletedBy: req.user.id });

        return ResponseFormatter.success(res, 200, 'Submission deleted successfully', { deleted: true });
    } catch (error) {
        if (error.message.includes('not found')) {
            return ResponseFormatter.error(res, 404, 'Submission not found');
        }
        logger.error('Error deleting submission', { id, error: error.message });
        throw error;
    }
}));

module.exports = router;
