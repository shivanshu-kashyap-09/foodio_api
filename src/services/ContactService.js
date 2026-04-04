/**
 * FOODIO API - Contact Service
 * Business logic for contact form submissions
 */

const Database = require('../utils/Database');
const Logger = require('../utils/Logger');
const MailerService = require('./MailerService');

const logger = new Logger('ContactService');

class ContactService {
    /**
     * Submit contact form
     */
    static async submitContactForm(data) {
        try {
            const {
                name,
                email,
                phone,
                subject,
                message,
            } = data;

            const query = `
                INSERT INTO contact_form (
                    name,
                    email,
                    phone,
                    subject,
                    message,
                    status,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, NOW())
            `;

            const result = await Database.query(query, [
                name,
                email,
                phone,
                subject,
                message,
                'new',
            ]);

            // Send confirmation email to user
            try {
                await MailerService.sendContactConfirmation(email, name);
            } catch (error) {
                logger.warn('Failed to send contact confirmation email', { email, error: error.message });
            }

            // Send notification email to admin
            try {
                await MailerService.sendAdminContactNotification(name, email, subject, message);
            } catch (error) {
                logger.warn('Failed to send admin contact notification', { error: error.message });
            }

            logger.info('Contact form submitted', { id: result.insertId, email });

            return { id: result.insertId, ...data };
        } catch (error) {
            logger.error('submitContactForm error', { error: error.message });
            throw error;
        }
    }

    /**
     * Get all contact submissions (admin)
     */
    static async getAllSubmissions(page = 1, limit = 10, status = null) {
        try {
            const offset = (page - 1) * limit;

            let query = `SELECT * FROM contact_form`;
            let countQuery = `SELECT COUNT(*) as total FROM contact_form`;
            const params = [];

            if (status) {
                query += ` WHERE status = ?`;
                countQuery += ` WHERE status = ?`;
                params.push(status);
            }

            query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;

            const [submissions, countResult] = await Promise.all([
                Database.query(query, [...params, parseInt(limit), offset]),
                Database.query(countQuery, params),
            ]);

            const total = countResult[0]?.total || 0;

            return {
                submissions,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            };
        } catch (error) {
            logger.error('getAllSubmissions error', { error: error.message });
            throw error;
        }
    }

    /**
     * Get submission by ID
     */
    static async getSubmissionById(id) {
        try {
            const query = `SELECT * FROM contact_form WHERE id = ?`;

            const result = await Database.queryOne(query, [id]);

            return result;
        } catch (error) {
            logger.error('getSubmissionById error', { id, error: error.message });
            throw error;
        }
    }

    /**
     * Update submission status
     */
    static async updateSubmissionStatus(id, status) {
        try {
            const validStatuses = ['new', 'in-progress', 'resolved', 'closed'];

            if (!validStatuses.includes(status)) {
                throw new Error(`Invalid status: ${status}`);
            }

            const query = `
                UPDATE contact_form
                SET status = ?, updated_at = NOW()
                WHERE id = ?
            `;

            const result = await Database.query(query, [status, id]);

            if (result.affectedRows === 0) {
                return null;
            }

            logger.info('Submission status updated', { id, status });

            return await this.getSubmissionById(id);
        } catch (error) {
            logger.error('updateSubmissionStatus error', { id, error: error.message });
            throw error;
        }
    }

    /**
     * Add reply to submission
     */
    static async addReply(submissionId, replyMessage) {
        try {
            const query = `
                UPDATE contact_form
                SET reply_message = ?, status = 'resolved', updated_at = NOW()
                WHERE id = ?
            `;

            const result = await Database.query(query, [replyMessage, submissionId]);

            if (result.affectedRows === 0) {
                return null;
            }

            logger.info('Reply added to submission', { submissionId });

            return await this.getSubmissionById(submissionId);
        } catch (error) {
            logger.error('addReply error', { submissionId, error: error.message });
            throw error;
        }
    }

    /**
     * Delete submission
     */
    static async deleteSubmission(id) {
        try {
            const query = `DELETE FROM contact_form WHERE id = ?`;

            const result = await Database.query(query, [id]);

            if (result.affectedRows === 0) {
                return null;
            }

            logger.info('Submission deleted', { id });

            return true;
        } catch (error) {
            logger.error('deleteSubmission error', { id, error: error.message });
            throw error;
        }
    }
}

module.exports = ContactService;
