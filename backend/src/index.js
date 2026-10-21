import { app } from './app.js';

const PORTA = Number(process.env.PORT) || 3000;

app.listen(PORTA, () => {
  console.log(`API GoBeach ouvindo na porta ${PORTA}`);
});
