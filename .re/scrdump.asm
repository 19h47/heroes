; SCRDUMP.COM — resident screen grabber for DOSBox captures (nasm -f bin -o SCRDUMP.COM scrdump.asm).
; Every four timer ticks it compares the 80x25 colour text page at B800:0000 with the last copy and, when
; it changed, writes the 4000 character/attribute bytes to Snnnn.SCR in the current directory.
	org 100h
start:	jmp install

old1c	dd 0
indos	dd 0
busy	db 0
tick	db 0
count	dw 0
fname	db 'S0000.SCR', 0

handler:
	pushf
	call far [cs:old1c]
	cmp byte [cs:busy], 0
	jne .ret
	inc byte [cs:tick]
	cmp byte [cs:tick], 4
	jb .ret
	push ax
	push bx
	push cx
	push dx
	push si
	push di
	push ds
	push es
	les bx, [cs:indos]
	cmp byte [es:bx], 0
	jne .skip
	mov byte [cs:tick], 0
	mov byte [cs:busy], 1
	cld
	mov ax, 0B800h
	mov ds, ax
	push cs
	pop es
	xor si, si
	mov di, buf
	mov cx, 2000
	repe cmpsw
	je .done
	xor si, si
	mov di, buf
	mov cx, 2000
	rep movsw
	push cs
	pop ds
	mov ax, [count]
	inc word [count]
	mov bx, 10
	mov di, fname + 4
	mov cx, 4
.digit:	xor dx, dx
	div bx
	add dl, '0'
	mov [di], dl
	dec di
	loop .digit
	mov ah, 3Ch
	xor cx, cx
	mov dx, fname
	int 21h
	jc .done
	mov bx, ax
	mov ah, 40h
	mov cx, 4000
	mov dx, buf
	int 21h
	mov ah, 3Eh
	int 21h
.done:	mov byte [cs:busy], 0
.skip:	pop es
	pop ds
	pop di
	pop si
	pop dx
	pop cx
	pop bx
	pop ax
.ret:	iret

buf	times 4000 db 0
resident_end:

install:
	mov ax, 351Ch
	int 21h
	mov [old1c], bx
	mov [old1c + 2], es
	mov ah, 34h
	int 21h
	mov [indos], bx
	mov [indos + 2], es
	mov ax, 251Ch
	mov dx, handler
	int 21h
	mov dx, (resident_end - start + 100h + 15) / 16
	mov ax, 3100h
	int 21h
