// Render a data-only allowlisted document tree. No HTML, URLs or event attributes are accepted.
export const readerTags=new Set(['p','ul','ol','li','b','strong','em','i','h2','h3','h4','blockquote','table','thead','tbody','tr','th','td','br','code']);
export function appendReaderNodes(parent,nodes){
 const doc=parent.ownerDocument;let count=0;
 function append(target,list,depth){if(depth>20||!Array.isArray(list))return;for(const item of list){if(++count>10000)return;if(typeof item?.text==='string'){target.append(doc.createTextNode(item.text));continue;}if(!readerTags.has(item?.tag))continue;const node=doc.createElement(item.tag);append(node,item.children,depth+1);target.append(node);}}
 append(parent,nodes,0);
}
