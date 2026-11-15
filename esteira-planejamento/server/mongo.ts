import { MongoClient, type Db } from 'mongodb';

let clientP: Promise<Db> | null = null;

export function mongo(): Promise<Db> {
  if (!clientP) {
    const uri = process.env.MNDY_MONGODB_CONNECTION_STRING;
    if (!uri) throw new Error('Banco do app indisponível (MNDY_MONGODB_CONNECTION_STRING ausente).');
    const client = new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 15000 });
    clientP = client.connect().then((c) => c.db()).catch((e) => { clientP = null; throw e; });
  }
  return clientP;
}
