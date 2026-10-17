/* Decorative AL-LTC animation. No account data or external requests. */
(function () {
"use strict";
/* Decorative, self-contained SVG scenes. No network assets or SVG-side timers. */
const scenes = [
  `<svg class="auth-art" viewBox="0 0 480 420" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="al-register-shirt" x1="109" y1="172" x2="222" y2="284" gradientUnits="userSpaceOnUse"><stop stop-color="#2DC9BB"/><stop offset="1" stop-color="#159B95"/></linearGradient>
      <linearGradient id="al-register-screen" x1="206" y1="224" x2="325" y2="294" gradientUnits="userSpaceOnUse"><stop stop-color="#F2F8FC"/><stop offset="1" stop-color="#BCD3E2"/></linearGradient>
      <linearGradient id="al-register-card" x1="278" y1="67" x2="408" y2="224" gradientUnits="userSpaceOnUse"><stop stop-color="#FCFEFF"/><stop offset="1" stop-color="#DDEBF3"/></linearGradient>
    </defs>
    <!-- Architectural background and quiet ambient details. -->
    <path d="M66 193C54 117 107 53 183 57C255 61 269 107 337 105C400 103 430 154 410 216C392 271 411 323 337 341C258 359 242 321 176 335C104 351 78 289 66 193Z" fill="#183F59" fill-opacity=".48"/>
    <circle cx="230" cy="84" r="40" stroke="#5586A2" stroke-opacity=".16"/>
    <path d="M66 132H91M78.5 119.5V144.5" stroke="#5AD4C6" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/>
    <circle cx="417" cy="248" r="4" fill="#F6A64B" fill-opacity=".7"/>
    <circle cx="123" cy="71" r="3" fill="#76A8C1" fill-opacity=".65"/>
    <path d="M339 293L344 288L349 293L344 298Z" fill="#48C5B8" fill-opacity=".6"/>
    <ellipse cx="241" cy="363" rx="174" ry="16" fill="#071E30" fill-opacity=".44"/>
    <!-- Raised registration card. -->
    <g class="animatedpart art-float-register">
      <rect x="273" y="79" width="147" height="166" rx="18" fill="#071D30" fill-opacity=".2"/>
      <rect x="267" y="70" width="147" height="166" rx="18" fill="url(#al-register-card)"/>
      <rect x="267.5" y="70.5" width="146" height="165" rx="17.5" stroke="#FFF" stroke-opacity=".6"/>
      <rect x="283" y="85" width="30" height="30" rx="10" fill="#D9F1ED"/>
      <circle cx="298" cy="95" r="4" fill="#168D88"/>
      <path d="M290 108C290 103.6 293.6 101 298 101C302.4 101 306 103.6 306 108" fill="#168D88"/>
      <rect x="324" y="91" width="69" height="5" rx="2.5" fill="#183D56"/>
      <rect x="324" y="102" width="48" height="4" rx="2" fill="#8FAABB"/>
      <rect x="283" y="128" width="115" height="25" rx="6" fill="#FFF" stroke="#CDDFE8"/>
      <rect x="293" y="138" width="68" height="5" rx="2.5" fill="#B2CAD7"/>
      <rect class="animatedpart art-register-line-one" x="293" y="138" width="68" height="5" rx="2.5" fill="#429F9B"/>
      <rect x="283" y="161" width="115" height="25" rx="6" fill="#FFF" stroke="#CDDFE8"/>
      <g fill="#B2CAD7"><circle cx="295" cy="173.5" r="2"/><circle cx="303" cy="173.5" r="2"/><circle cx="311" cy="173.5" r="2"/><circle cx="319" cy="173.5" r="2"/><circle cx="327" cy="173.5" r="2"/><circle cx="335" cy="173.5" r="2"/></g>
      <rect class="animatedpart art-register-line-two" x="291" y="170" width="47" height="7" rx="3.5" fill="#429F9B"/>
      <rect x="283" y="199" width="115" height="22" rx="7" fill="#14968E"/>
      <path d="M328 210H352M347 205L352 210L347 215" stroke="#FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <g class="animatedpart art-register-check">
        <circle cx="411" cy="77" r="19" fill="#36C7B6"/>
        <circle cx="411" cy="77" r="14" stroke="#BEF3E9" stroke-opacity=".6"/>
        <path d="M403 77L408.5 82.5L419 72" stroke="#FFF" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    </g>
    <!-- Chair and seated legs. -->
    <path d="M104 243V312C104 320 111 327 119 327H170" stroke="#537D92" stroke-width="11" stroke-linecap="round"/>
    <path d="M118 320L102 359M162 321L176 359" stroke="#385E76" stroke-width="7" stroke-linecap="round"/>
    <path d="M136 274C149 270 172 269 185 276L213 305L191 324L164 299L144 309C126 314 115 294 136 274Z" fill="#203F59"/>
    <path d="M182 289L200 314L188 347" stroke="#304F68" stroke-width="25" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M134 296L145 323L152 350" stroke="#233F59" stroke-width="25" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M141 347L163 344L181 354C185 357 183 361 178 362H142C139 359 139 352 141 347Z" fill="#E5EFF4"/>
    <path d="M181 343L199 349L208 359C210 362 207 365 203 365H177C175 359 178 350 181 343Z" fill="#D4E4ED"/>
    <path d="M144 357H178M180 360H203" stroke="#9CB7C8" stroke-width="2" stroke-linecap="round"/>
    <!-- Registering learner, gentle posture motion. -->
    <g class="animatedpart art-register-person">
      <path d="M116 173C127 165 149 164 164 172C181 180 186 200 188 222L187 278C166 291 128 287 111 278L107 216C105 197 107 182 116 173Z" fill="url(#al-register-shirt)"/>
      <path d="M135 173L145 181L158 171" stroke="#107E7C" stroke-width="2" stroke-linecap="round"/>
      <path d="M116 237L120 272M169 208L175 250M130 278C145 281 163 281 176 276" stroke="#128F89" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>
      <path d="M134 149L132 173C139 181 151 182 158 172L156 151" fill="#D99B78"/>
      <g class="animatedpart art-register-head">
        <path d="M121 121C121 99 136 89 155 94C171 98 174 114 171 132L166 152C163 163 153 170 143 165L128 153Z" fill="#E9B38E"/>
        <path d="M126 135C117 135 114 125 116 115C112 110 113 100 122 98C126 86 141 83 154 89C169 87 181 100 177 111C174 120 165 121 161 117L157 106C150 114 139 116 130 113L130 135Z" fill="#132C42"/>
        <path d="M126 135C120 130 116 136 119 143C121 148 126 148 129 145" fill="#E9B38E"/>
        <path d="M122 138L125 142" stroke="#C88B70" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M157 129L160 139L155 141" stroke="#C88B70" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M145 126L151 125M163 125L168 126" stroke="#29364A" stroke-width="2" stroke-linecap="round"/>
        <path d="M148 132V134M165 132V134" stroke="#243449" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M148 150C151 153 156 154 160 150" stroke="#9D5D4D" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M132 150C135 158 141 164 149 165" stroke="#D49A79" stroke-width="2" stroke-linecap="round"/>
      </g>
      <path d="M170 184C182 182 186 196 191 210L204 240L229 251L220 264L187 252C181 249 178 243 176 238L161 207C156 196 160 187 170 184Z" fill="#20B1A7"/>
      <g class="animatedpart art-register-hand-far">
        <path d="M202 241L224 249L244 247C251 247 255 251 256 254L259 260L241 263L222 263L201 255Z" fill="#D99B78"/>
        <path d="M239 250L249 253M239 254L251 257" stroke="#BD7B62" stroke-width="1.3" stroke-linecap="round"/>
      </g>
      <path d="M117 185C128 182 136 191 137 203L139 239L176 255L169 272L122 255C115 252 111 246 110 238L105 205C104 196 109 188 117 185Z" fill="#2BC5B7"/>
      <path d="M131 241L136 245M116 213L119 237" stroke="#159C94" stroke-width="2" stroke-linecap="round"/>
      <g class="animatedpart art-register-hand-near">
        <path d="M171 253L192 257L215 253C221 252 224 255 226 258L230 264L210 269L191 271L167 267Z" fill="#EBB38E"/>
        <path d="M209 258L220 260M208 262L222 264" stroke="#CB8D70" stroke-width="1.4" stroke-linecap="round"/>
      </g>
    </g>
    <!-- Laptop, visible keyboard, and desk. -->
    <path d="M181 275L272 269L308 281L216 290Z" fill="#B2CBDC"/>
    <path d="M188 277L271 272L292 279L214 285Z" fill="#789FB7"/>
    <path d="M200 277L269 274M207 280L277 277" stroke="#D3E3ED" stroke-width="1.5" stroke-dasharray="4 3"/>
    <path d="M232 219H327C331 219 333 222 332 226L316 281H214L227 223C228 220 229 219 232 219Z" fill="#6E93AD"/>
    <path d="M236 223H328L313 278H222L233 226C233.5 224 234 223 236 223Z" fill="url(#al-register-screen)"/>
    <path d="M181 285H315L316 290H190C185 290 182 288 181 285Z" fill="#E3EEF5"/>
    <path d="M270 248C271 243 275 241 279 243C282 245 281 250 277 253C273 256 268 254 270 248Z" fill="#7CA5BA"/>
    <rect x="81" y="290" width="290" height="10" rx="5" fill="#E5B68A"/>
    <path d="M94 300L85 358M352 300L361 358" stroke="#A78065" stroke-width="7" stroke-linecap="round"/>
    <path d="M96 300H349" stroke="#B98B6A" stroke-width="3"/>
    <!-- Warm coffee accent and a small, grounded plant. -->
    <path d="M335 268H352L350 287H338Z" fill="#EBA55D"/>
    <path d="M352 272H356C361 272 361 280 355 281H351" stroke="#EBA55D" stroke-width="3"/>
    <ellipse cx="343.5" cy="268" rx="8.5" ry="2.5" fill="#FFD2A2"/>
    <path class="animatedpart art-steam" d="M341 259C336 254 346 252 341 246M348 260C344 256 351 253 348 249" stroke="#B4D7DF" stroke-opacity=".45" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M393 327V291" stroke="#449E95" stroke-width="3" stroke-linecap="round"/>
    <path d="M392 311C374 309 369 295 372 286C386 287 395 297 392 311Z" fill="#29A89B"/>
    <path d="M394 300C393 282 405 271 416 273C419 286 409 298 394 300Z" fill="#59C7AE"/>
    <path d="M394 319C398 304 413 299 421 304C419 317 407 324 394 319Z" fill="#218F88"/>
    <path d="M377 323H410L405 353C404 358 383 358 382 353Z" fill="#D58D58"/>
    <path d="M382 327L386 351M390 328L392 352" stroke="#ECAF7D" stroke-width="2" stroke-linecap="round"/>
    <rect x="375" y="321" width="37" height="7" rx="3.5" fill="#EEB17B"/>
  </svg>`,
  `<svg class="auth-art" viewBox="0 0 480 420" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="al-learn-screen" x1="74" y1="86" x2="288" y2="251" gradientUnits="userSpaceOnUse"><stop stop-color="#F8FCFF"/><stop offset="1" stop-color="#D8E9F1"/></linearGradient>
      <linearGradient id="al-learn-shirt" x1="286" y1="196" x2="368" y2="309" gradientUnits="userSpaceOnUse"><stop stop-color="#F4BC82"/><stop offset="1" stop-color="#D98C59"/></linearGradient>
      <linearGradient id="al-learn-video" x1="91" y1="125" x2="219" y2="218" gradientUnits="userSpaceOnUse"><stop stop-color="#245976"/><stop offset="1" stop-color="#12354F"/></linearGradient>
    </defs>
    <path d="M57 194C50 118 104 61 173 70C240 80 267 50 326 73C387 98 413 158 397 217C381 277 425 306 357 342C290 376 248 328 188 345C115 366 64 295 57 194Z" fill="#183F59" fill-opacity=".48"/>
    <circle cx="368" cy="103" r="37" stroke="#5586A2" stroke-opacity=".17"/>
    <path d="M65 269H81M73 261V277" stroke="#F2B371" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>
    <circle cx="409" cy="173" r="4" fill="#54C7B7" fill-opacity=".7"/>
    <circle cx="107" cy="65" r="3" fill="#76A8C1" fill-opacity=".65"/>
    <ellipse cx="243" cy="365" rx="175" ry="15" fill="#071E30" fill-opacity=".44"/>
    <!-- Floating lesson window, with a geometric teaching graphic. -->
    <g class="animatedpart art-float-lesson">
      <rect x="71" y="94" width="235" height="176" rx="17" fill="#071D30" fill-opacity=".18"/>
      <rect x="65" y="86" width="235" height="176" rx="17" fill="url(#al-learn-screen)"/>
      <rect x="65.5" y="86.5" width="234" height="175" rx="16.5" stroke="#FFF" stroke-opacity=".6"/>
      <path d="M65 114H300" stroke="#CADFEA"/>
      <circle cx="82" cy="100" r="3" fill="#F0A969"/><circle cx="93" cy="100" r="3" fill="#69BBAD"/><circle cx="104" cy="100" r="3" fill="#A1BDCD"/>
      <rect x="231" y="98" width="51" height="4" rx="2" fill="#A0BACA"/>
      <rect x="80" y="126" width="141" height="99" rx="9" fill="url(#al-learn-video)"/>
      <path d="M93 213L126 182L148 198L178 163L207 180" stroke="#55BAAF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M94 214L126 183L148 199L178 164L207 181V225H94Z" fill="#42B3A5" fill-opacity=".12"/>
      <rect x="95" y="141" width="36" height="4" rx="2" fill="#A4D2DD" fill-opacity=".65"/>
      <rect x="95" y="151" width="23" height="3" rx="1.5" fill="#A4D2DD" fill-opacity=".35"/>
      <circle cx="196" cy="145" r="6" fill="#EAA064"/>
      <g class="animatedpart art-lesson-play">
        <circle cx="152" cy="176" r="21" fill="#F3FCFD" fill-opacity=".96"/>
        <circle cx="152" cy="176" r="27" stroke="#D8F9F2" stroke-opacity=".2"/>
        <path d="M148 168L160 176L148 184Z" fill="#168D86"/>
      </g>
      <rect x="233" y="128" width="52" height="5" rx="2.5" fill="#2A536B"/>
      <rect x="233" y="140" width="41" height="3" rx="1.5" fill="#A4BCCB"/>
      <rect x="231" y="156" width="56" height="19" rx="5" fill="#CAE9E4"/>
      <circle cx="241" cy="165.5" r="4" fill="#219E91"/>
      <path d="M239 165.5L240.5 167L243 164" stroke="#FFF" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="250" y="164" width="27" height="3" rx="1.5" fill="#5A9E98"/>
      <circle cx="241" cy="187" r="4" stroke="#93AFBF" stroke-width="1.5"/>
      <rect x="250" y="185.5" width="29" height="3" rx="1.5" fill="#A4BCCB"/>
      <circle cx="241" cy="208" r="4" stroke="#93AFBF" stroke-width="1.5"/>
      <rect x="250" y="206.5" width="24" height="3" rx="1.5" fill="#A4BCCB"/>
      <rect x="80" y="238" width="204" height="5" rx="2.5" fill="#BDCFDB"/>
      <rect class="animatedpart art-lesson-progress" x="80" y="238" width="170" height="5" rx="2.5" fill="#25AA9D"/>
    </g>
    <!-- A compact learning note, independent of completion or awards. -->
    <g class="animatedpart art-float-note">
      <rect x="99" y="274" width="74" height="60" rx="10" fill="#F6E1C8"/>
      <path d="M116 289H155M116 299H150M116 309H140" stroke="#C3946F" stroke-width="3" stroke-linecap="round"/>
      <path d="M161 273L157 285" stroke="#EBA267" stroke-width="7" stroke-linecap="round"/>
    </g>
    <!-- Chair and relaxed seated posture. -->
    <path d="M373 253V322C373 328 368 332 361 332H311" stroke="#537D92" stroke-width="10" stroke-linecap="round"/>
    <path d="M315 329L302 363M361 329L377 363" stroke="#385E76" stroke-width="7" stroke-linecap="round"/>
    <path d="M344 299L320 318L310 354" stroke="#25465F" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M323 300L292 320L282 354" stroke="#31546D" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M272 348L290 353L292 364H259C254 364 254 360 258 357Z" fill="#D9E8EF"/>
    <path d="M302 349L321 353L324 364H292C288 364 287 360 292 357Z" fill="#EDF5F8"/>
    <path d="M260 361H286M294 361H320" stroke="#9BB8C9" stroke-width="2" stroke-linecap="round"/>
    <g class="animatedpart art-learner-person">
      <path d="M298 196C308 188 330 187 345 197C359 207 362 227 362 249L360 301C338 312 311 310 290 299L288 234C287 216 290 204 298 196Z" fill="url(#al-learn-shirt)"/>
      <path d="M301 231L302 278M345 230L349 281M305 300C320 304 338 304 350 298" stroke="#BD754F" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/>
      <path d="M310 175L307 197C314 204 325 203 333 195L330 176Z" fill="#C88E6C"/>
      <path d="M304 197L318 208L335 195" stroke="#EED2AF" stroke-width="3" stroke-linecap="round"/>
      <g class="animatedpart art-learner-head">
        <path d="M295 153C290 125 305 108 324 111C348 113 356 133 351 155L353 190C342 199 329 200 318 194L300 182Z" fill="#183044"/>
        <path d="M300 139C302 122 320 119 334 129C341 134 342 149 339 162C336 177 330 188 318 188C307 187 298 178 296 165L294 153Z" fill="#DAA482"/>
        <path d="M299 147C308 143 317 134 318 125C329 131 338 139 340 150L347 143L339 120L318 115L299 123L292 141Z" fill="#193247"/>
        <path d="M297 151L293 160L298 163" stroke="#B97D61" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M300 145L305 143M317 144L323 145" stroke="#3A3640" stroke-width="2" stroke-linecap="round"/>
        <path d="M301 151V153M319 151V153" stroke="#2D3340" stroke-width="2.1" stroke-linecap="round"/>
        <path d="M302 172C306 175 311 175 314 172" stroke="#965D4C" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M332 156C338 151 341 157 338 165C337 170 333 171 330 168" fill="#DAA482"/>
        <path d="M334 158L332 164" stroke="#BD8164" stroke-width="1.5" stroke-linecap="round"/>
        <!-- Soft, over-ear headphones and a short microphone. -->
        <path d="M292 149C288 126 297 109 317 107C337 106 350 122 348 145" stroke="#6CCEC1" stroke-width="7" stroke-linecap="round"/>
        <path d="M294 138C294 121 302 113 316 111" stroke="#C8F1E8" stroke-width="2" stroke-linecap="round"/>
        <rect x="285" y="143" width="11" height="24" rx="5.5" fill="#39AFA6"/>
        <rect x="336" y="145" width="15" height="27" rx="7.5" transform="rotate(8 336 145)" fill="#65CDBE"/>
        <rect x="340" y="149" width="6" height="18" rx="3" transform="rotate(8 340 149)" fill="#B5EFE2"/>
        <path d="M338 169C335 178 328 181 320 180" stroke="#78D6C8" stroke-width="2" stroke-linecap="round"/>
        <rect x="314" y="177" width="8" height="5" rx="2.5" fill="#B5EFE2"/>
      </g>
      <path d="M297 210C306 207 313 215 311 227L305 261L281 280L269 268L286 249L286 226C285 218 289 212 297 210Z" fill="#E9AA72"/>
      <path d="M279 267L263 274L249 285L261 293L280 285L291 278Z" fill="#D49A77"/>
      <path d="M344 210C353 210 360 220 358 231L350 270C349 276 345 280 339 283L304 296L297 280L326 267L330 229C330 218 335 211 344 210Z" fill="#F0B980"/>
      <path d="M335 229L331 264M344 271L338 275" stroke="#CB895A" stroke-width="2" stroke-linecap="round"/>
      <g class="animatedpart art-learner-hand">
        <path d="M303 279L284 283L272 279C267 279 264 283 265 287L269 295L282 299L306 293Z" fill="#DFA784"/>
        <path d="M269 283L278 287M268 287L276 291" stroke="#BA7C5D" stroke-width="1.3" stroke-linecap="round"/>
        <path d="M277 289L261 266" stroke="#236782" stroke-width="4" stroke-linecap="round"/>
        <path d="M260 264L257 259L258 265" fill="#E4C19D"/>
      </g>
    </g>
    <!-- Open workbook and simple writing surface. -->
    <path d="M188 288L239 283L275 298L239 316L183 299Z" fill="#81A9BE"/>
    <path d="M188 283C209 280 226 283 240 290L240 309C223 301 208 298 185 299Z" fill="#FFF9EB"/>
    <path d="M240 290C251 281 269 277 287 282L291 298C272 297 254 301 240 309Z" fill="#F1E8D4"/>
    <path d="M240 291V308" stroke="#D4C4A8" stroke-width="1.5"/>
    <path d="M198 288L227 293M197 293L220 297M252 289L278 285M254 294L281 290" stroke="#C9BCA3" stroke-width="1.4" stroke-linecap="round"/>
    <rect x="162" y="309" width="223" height="10" rx="5" fill="#D5E6EE"/>
    <path d="M176 319L168 361M371 319L379 361" stroke="#7899AC" stroke-width="7" stroke-linecap="round"/>
    <!-- Small desk lamp points toward the lesson. -->
    <path d="M398 307V264L378 245" stroke="#6496A9" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M365 238L378 226L394 248L373 258Z" fill="#44B7AA"/>
    <path d="M374 257L393 249" stroke="#B9EEE0" stroke-width="3" stroke-linecap="round"/>
    <path d="M387 308H408" stroke="#84B4C5" stroke-width="6" stroke-linecap="round"/>
  </svg>`
];

  function mount(panel) {
    if (!panel) return function () {};
    const mobile = window.matchMedia('(max-width: 760px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const media = document.createElement('div');
    media.className = 'auth-scenes'; media.setAttribute('aria-hidden', 'true');
    const controls = document.createElement('div'); controls.className = 'auth-scene-controls';
    controls.setAttribute('role','group'); controls.setAttribute('aria-label','مشاهد التعلّم المتحركة');
    let timer = null, index = 0, disposed = false, paused = false, hovering = false, focused = false, selected = false;
    const frames = [];
    const dots = scenes.map((scene, i) => {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'auth-scene-dot'; button.setAttribute('aria-label', i === 0 ? 'مشهد إنشاء الحساب' : 'مشهد التعلّم');
      button.setAttribute('aria-pressed', String(i === 0));
      button.onclick = () => { selected = true; show(i); };
      controls.appendChild(button); return button;
    });
    const pause = document.createElement('button'); pause.type = 'button'; pause.className = 'auth-scene-pause';
    controls.appendChild(pause); panel.prepend(media); panel.appendChild(controls);
    function stop() { if (timer !== null) { window.clearTimeout(timer); timer = null; } }
    function running() { return !disposed && !paused && !mobile.matches && !reduced.matches && !document.hidden; }
    function schedule() {
      stop(); media.classList.toggle('is-running', running()); panel.classList.toggle('auth-motion-still', !running());
      if (running() && !hovering && !focused && !selected) timer = window.setTimeout(() => show((index + 1) % scenes.length), 10000);
    }
    function paintPause() {
      const still = paused || reduced.matches;
      pause.textContent = still ? 'تشغيل الحركة' : 'إيقاف الحركة';
      pause.setAttribute('aria-pressed', String(!still));
      pause.setAttribute('aria-label', still ? 'تشغيل حركة المشاهد' : 'إيقاف حركة المشاهد');
      pause.disabled = reduced.matches;
      if (reduced.matches) { pause.textContent = 'مشاهد ثابتة'; pause.setAttribute('aria-label','الحركة متوقفة وفق إعداد تقليل الحركة'); }
    }
    function show(next) {
      if (disposed) return;
      index = next;
      if (!mobile.matches && !frames.length) {
        scenes.forEach(markup => {
          const frame = document.createElement('div'); frame.className = 'auth-scene';
          // These SVG strings are static, reviewed local artwork, never user content.
          frame.innerHTML = markup; frames.push(frame); media.appendChild(frame);
        });
      }
      frames.forEach((frame, i) => frame.classList.toggle('on', i === index));
      dots.forEach((dot, i) => dot.setAttribute('aria-pressed', String(i === index)));
      schedule();
    }
    pause.onclick = () => { paused = !paused; if (!paused) selected = false; paintPause(); schedule(); };
    const enter = () => { hovering = true; schedule(); };
    const leave = () => { hovering = false; schedule(); };
    const focusIn = () => { focused = true; schedule(); };
    const focusOut = event => { if (!panel.contains(event.relatedTarget)) { focused = false; schedule(); } };
    const visibility = () => schedule();
    const preference = () => { paintPause(); show(index); };
    panel.addEventListener('mouseenter', enter); panel.addEventListener('mouseleave', leave);
    panel.addEventListener('focusin', focusIn); panel.addEventListener('focusout', focusOut);
    document.addEventListener('visibilitychange', visibility);
    mobile.addEventListener('change', preference); reduced.addEventListener('change', preference);
    paintPause(); show(0);
    return function dispose() {
      if (disposed) return; disposed = true; stop(); media.classList.remove('is-running');
      panel.removeEventListener('mouseenter', enter); panel.removeEventListener('mouseleave', leave);
      panel.removeEventListener('focusin', focusIn); panel.removeEventListener('focusout', focusOut);
      document.removeEventListener('visibilitychange', visibility);
      mobile.removeEventListener('change', preference); reduced.removeEventListener('change', preference);
      dots.forEach(dot => { dot.onclick = null; }); pause.onclick = null;
      panel.classList.remove('auth-motion-still'); media.remove(); controls.remove();
    };
  }
  window.AUTH_VISUAL = { mount };
})();
