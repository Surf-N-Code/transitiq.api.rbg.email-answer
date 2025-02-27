import { Router } from 'express';
import emailRoutes from './emails';

const router = Router();

router.use('/emails', emailRoutes);

export default router;
