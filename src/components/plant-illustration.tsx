export function PlantIllustration({ small = false }: { small?: boolean }) {
  return <svg className={small ? "plant-art plant-art-small" : "plant-art"} viewBox="0 0 480 460" fill="none" aria-hidden="true">
    <ellipse cx="240" cy="418" rx="150" ry="18" fill="#153F30" opacity=".13" />
    <circle cx="251" cy="209" r="161" fill="#E2E9C9" opacity=".55" />
    <path d="M241 340C234 277 258 213 248 127M244 281C200 246 169 209 155 165M242 306C294 263 319 211 327 174M247 212C218 189 202 155 197 123" stroke="#45694B" strokeWidth="7" strokeLinecap="round" />
    <path d="M248 184C180 156 205 73 279 55C305 113 292 167 248 184Z" fill="#456F46" />
    <path d="M245 176L270 77" stroke="#B8CE8D" strokeWidth="2" />
    <path d="M211 250C145 259 101 211 103 145C177 140 224 174 211 250Z" fill="#608552" />
    <path d="M202 239L120 164" stroke="#B8CE8D" strokeWidth="2" />
    <path d="M260 279C257 199 307 164 378 170C375 242 332 284 260 279Z" fill="#37684A" />
    <path d="M274 268L358 185" stroke="#A8C786" strokeWidth="2" />
    <path d="M206 169C150 163 136 110 154 66C209 80 231 120 206 169Z" fill="#82A368" />
    <path d="M203 157L163 84" stroke="#D2DEAC" strokeWidth="2" />
    <path d="M314 220C294 161 322 113 374 100C391 155 372 202 314 220Z" fill="#85A16B" />
    <path d="M322 207L365 118" stroke="#C7D8A7" strokeWidth="2" />
    <path d="M183 325H302L287 400C284 415 198 415 195 400L183 325Z" fill="#C88060" />
    <path d="M183 325H242V410C218 410 198 407 195 400L183 325Z" fill="#B36B50" />
    <rect x="174" y="315" width="137" height="22" rx="7" fill="#D99675" />
    <path d="M129 310L134 298M124 301L139 306M359 300L366 288M357 290L369 298" stroke="#A2B783" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}
