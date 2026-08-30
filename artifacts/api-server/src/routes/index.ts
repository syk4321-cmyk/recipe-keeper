import { Router, type IRouter } from "express";
import healthRouter from "./health";
import recipeRouter from "./recipe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(recipeRouter);

export default router;
