/** Standard direction characters → absolute angle */
const pathDataTable: Record<string, number> = {
  "R": 0, "p": 15, "J": 30, "E": 45, "T": 60, "o": 75, "U": 90, "q": 105,
  "G": 120, "Q": 135, "H": 150, "W": 165, "L": 180, "x": 195, "N": 210,
  "Z": 225, "F": 240, "V": 255, "D": 270, "Y": 285, "B": 300, "C": 315,
  "M": 330, "A": 345, "!": 999
};

/**
 * Special offset characters — these are NOT absolute angles.
 * Instead, they represent a relative change from the previous angle:
 *   result = previous_angle + offset
 */
const offsetMap: Record<string, number> = {
  "5": 72,
  "6": -72,
  "7": 52,
  "8": -52,
  "9": -30,
  "h": 120,
  "j": -120,
  "t": 60,
  "y": 300,
};

const parseToangleData = (pathdata: string): number[] => {
  const result: number[] = new Array(pathdata.length);
  let prev = 0;

  for (let i = 0; i < pathdata.length; i++) {
    const c = pathdata[i];

    if (c in pathDataTable) {
      // Standard character: absolute angle
      result[i] = pathDataTable[c];
      prev = pathDataTable[c];
    } else if (c in offsetMap) {
      // Special character: relative offset from previous angle
      result[i] = prev + offsetMap[c];
      prev = result[i];
    } else {
      // Unknown character: keep current angle
      result[i] = prev;
    }
  }

  return result;
};

export default {
    pathDataTable,
    parseToangleData
}