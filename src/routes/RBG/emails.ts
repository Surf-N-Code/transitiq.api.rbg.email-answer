import { Router } from 'express';
import { ProcessEmailController } from '@/controller/RBG/ProcessEmailController';

const router = Router();

// GET /api/rbg/emails
router.get('/', ProcessEmailController.getEmails);

// POST /api/rbg/emails/:id/read
router.post('/:id/read', ProcessEmailController.markAsRead);

// POST /api/rbg/emails/:id/classify
router.post('/classify/:id', ProcessEmailController.classifyEmail);

// POST /api/rbg/emails/:id/process
router.post('/process-emails', ProcessEmailController.processEmails);

export default router;
