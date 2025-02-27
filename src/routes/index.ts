import { Router } from 'express';
import rbgRoutes from './RBG';

const router = Router();

router.use('/rbg', rbgRoutes);

export default router;
