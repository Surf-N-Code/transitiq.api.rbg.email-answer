import { addAliases } from 'module-alias';
import { join } from 'path';

// Register module aliases for runtime path resolution
addAliases({
  '@': join(__dirname),
});
