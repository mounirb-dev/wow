// Migración 004_import_verified_players: Importa perfiles públicos verificados (solo datos con fuente oficial).
// Public profile records gathered from official league/club or federation pages.
// Economic, performance and news fields stay empty until a dedicated source is connected.
const players = [
  {
    id: "saka",
    name: "Bukayo Saka",
    pos: "FW",
    age: 25,
    club: "Arsenal",
    contractEnd: "2030-06-30T00:00:00.000Z",
    sourceUrl: "https://www.premierleague.com/players/49481/overview",
  },
  {
    id: "odegaard",
    name: "Martin Ødegaard",
    pos: "MF",
    age: 27,
    club: "Arsenal",
    contractEnd: "2028-06-30T00:00:00.000Z",
    sourceUrl: "https://www.premierleague.com/en/players/184029/martin-degaard/overview",
  },
  {
    id: "rice",
    name: "Declan Rice",
    pos: "MF",
    age: 27,
    club: "Arsenal",
    contractEnd: "2028-06-30T00:00:00.000Z",
    sourceUrl: "https://www.englandfootball.com/england/mens-senior-team/squad/Declan-Rice",
  },
  {
    id: "saliba",
    name: "William Saliba",
    pos: "DF",
    age: 25,
    club: "Arsenal",
    contractEnd: "2030-06-30T00:00:00.000Z",
    sourceUrl: "https://www.laliga.com/en-GB/player/william-saliba",
  },
];

export async function up({ db, DB, ensureTable, waitColumns }) {
  await db.createStringColumn(DB, "players", "sourceUrl", 500, false);
  await db.createStringColumn(DB, "players", "dataStatus", 40, false);
  await waitColumns("players");

  for (const player of players) {
    await db.createRow(DB, "players", player.id, {
      name: player.name,
      pos: player.pos,
      age: player.age,
      club: player.club,
      contractEnd: player.contractEnd,
      value: 0,
      salary: 0,
      fair: 0,
      momentum: 0.5,
      seed: 0,
      sourceUrl: player.sourceUrl,
      dataStatus: "profile-only",
    });
  }
}
