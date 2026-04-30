import { redirect } from "next/navigation";

type Props = { searchParams: { folio?: string } };

/** Ruta anterior: la consulta publica vive en `/orden/consultar`. */
export default function SolicitudConsultarLegacyRedirect({ searchParams }: Props) {
  const folio = searchParams.folio;
  if (folio != null && String(folio).trim() !== "") {
    redirect(`/orden/consultar?folio=${encodeURIComponent(String(folio).trim())}`);
  }
  redirect("/orden/consultar");
}
