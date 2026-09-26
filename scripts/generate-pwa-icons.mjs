import sharp from "sharp";
import {mkdir,readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
const source=await readFile(new URL("../public/plantcare-icon.svg",import.meta.url));
const directory=new URL("../public/icons/",import.meta.url);await mkdir(directory,{recursive:true});
for(const size of [192,512,180])await sharp(source).resize(size,size).png().toFile(fileURLToPath(new URL(`icon-${size}.png`,directory)));
await sharp(source).resize(410,410).extend({top:51,bottom:51,left:51,right:51,background:"#2f6348"}).png().toFile(fileURLToPath(new URL("icon-maskable.png",directory)));
