# Páginas de los bares (GitHub Pages)

Cada carpeta es un bar:

- `<bar>/` → app del personal (admin, meseras, DJ).
- `<bar>/pedir/` → página del QR para los clientes.

En cada `index.html` va la dirección de la aplicación web de Google de ese bar (`window.SGB.app`, termina en `/exec`).
Para un bar nuevo, copia la carpeta `_plantilla` con el nombre del bar.
El recorte del aviso de Google se calibra en `marco.js` (`RECORTE` y `RECORTE_MOVIL`).
