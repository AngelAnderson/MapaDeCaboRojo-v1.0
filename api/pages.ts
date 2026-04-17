import municipioHandler from '../lib/municipio';
import turismoHandler from '../lib/turismo';
import demandaHandler from '../lib/demanda';
import intelligenceHandler from '../lib/intelligence';

export default async function handler(req: any, res: any) {
  const page = req.query?.page || '';

  switch (page) {
    case 'municipio':
      return municipioHandler(req, res);
    case 'turismo':
      return turismoHandler(req, res);
    case 'demanda':
      return demandaHandler(req, res);
    case 'intelligence':
      return intelligenceHandler(req, res);
    default:
      return res.status(404).json({ error: 'Page not found' });
  }
}
