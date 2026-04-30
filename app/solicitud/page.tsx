import { redirect } from "next/navigation";

/** Ruta anterior: el formulario publico vive en `/orden`. */
export default function SolicitudLegacyRedirect() {
  redirect("/orden");
}
