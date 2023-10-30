import { useState } from "react"
import { Paper, Slider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";


interface Rating {
  criteria: string;
  camille: number;
  vianney: number;
}

type Row = [string, number, number]

function createRating([
  criteria,
  camille,
  vianney,
]: Row) {
  return { criteria, camille, vianney };
}

const rows: Row[] = [
  ["Récits récents", 3, 2],
  ["Riche d'enseignement", 2, 4],
  ["Empathie envers un tiers", 5, 4],
  ["Tact", 4, 3],
  ["Potentiel arborescent", 3, 5],
];

const initialRatings: Rating[] = rows.map(createRating);

export default function App() {

  const [ratings, setRatings] = useState(initialRatings);

  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>Criteria</TableCell>
            <TableCell align="right">Camille</TableCell>
            <TableCell align="right">Vianney</TableCell>
            <TableCell align="right">Average</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ratings.map((rating) => (
            <TableRow
              key={rating.criteria}
              sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
            >
              <TableCell component="th" scope="row">
                {rating.criteria}
              </TableCell>
              <TableCell align="right">
              <Slider
                aria-label="rating"
                defaultValue={3}
                valueLabelDisplay="auto"
                step={5}
                marks
                min={1}
                max={5}
              />
{rating.camille}</TableCell>
              <TableCell align="right">{rating.vianney}</TableCell>
              <TableCell align="right">{(rating.camille + rating.vianney) / 2}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
