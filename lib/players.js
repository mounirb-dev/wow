// Fictional demo data (no real people). Money in M€; salaries per year.
export const NOW = new Date("2026-10-21T00:00:00Z");

export const players = [
  { id: "mvidal", name: "Mateo Vidal", age: 20, pos: "RW", club: "Atlético Costero", contractEnd: "2029-06-30", value: 18, salary: 1.4, fair: 2.3, momentum: 0.9, seed: 3,
    suitors: [{ club: "Real Norte", need: 82 }, { club: "Lyon Rouge", need: 55 }, { club: "Bavaria FC", need: 40 }] },
  { id: "lcastro", name: "Lucas Castro", age: 27, pos: "CB", club: "Sporting Valle", contractEnd: "2027-06-30", value: 12, salary: 2.1, fair: 2.6, momentum: 0.55, seed: 7,
    suitors: [{ club: "Real Norte", need: 70 }, { club: "Mersey Town", need: 66 }] },
  { id: "dsilva", name: "Diego Silva", age: 24, pos: "CM", club: "Racing Levante", contractEnd: "2027-01-31", value: 9, salary: 0.9, fair: 1.8, momentum: 0.7, seed: 11,
    suitors: [{ club: "Bavaria FC", need: 78 }, { club: "Lyon Rouge", need: 61 }, { club: "Porto Azul", need: 52 }] },
  { id: "jmoreau", name: "Jules Moreau", age: 31, pos: "ST", club: "Olympique Sud", contractEnd: "2026-12-31", value: 4.5, salary: 3.2, fair: 2.4, momentum: 0.25, seed: 5,
    suitors: [{ club: "Istanbul Gold", need: 74 }, { club: "Doha Stars", need: 90 }] },
  { id: "aibarra", name: "Andrés Ibarra", age: 22, pos: "LB", club: "Unión Cantábrica", contractEnd: "2028-06-30", value: 7, salary: 0.7, fair: 1.2, momentum: 0.8, seed: 13,
    suitors: [{ club: "Mersey Town", need: 80 }, { club: "Porto Azul", need: 58 }] },
  { id: "tkoval", name: "Tomás Koval", age: 19, pos: "AM", club: "Dinamo Este", contractEnd: "2030-06-30", value: 25, salary: 0.8, fair: 2.8, momentum: 0.95, seed: 17,
    suitors: [{ club: "Real Norte", need: 85 }, { club: "Bavaria FC", need: 72 }, { club: "Mersey Town", need: 69 }] },
  { id: "rnunez", name: "Rafa Núñez", age: 29, pos: "GK", club: "Sporting Valle", contractEnd: "2027-03-31", value: 5.5, salary: 1.6, fair: 1.7, momentum: 0.5, seed: 19,
    suitors: [{ club: "Istanbul Gold", need: 64 }] },
  { id: "ehassan", name: "Elias Hassan", age: 25, pos: "LW", club: "Atlético Costero", contractEnd: "2028-01-31", value: 14, salary: 1.9, fair: 2.7, momentum: 0.68, seed: 23,
    suitors: [{ club: "Doha Stars", need: 77 }, { club: "Lyon Rouge", need: 63 }] },
];

export const getPlayer = (id) => players.find((p) => p.id === id);
