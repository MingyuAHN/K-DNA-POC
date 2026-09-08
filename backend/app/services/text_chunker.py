from dataclasses import dataclass


@dataclass
class TextChunk:
    seq: int
    content: str
    start_char: int
    end_char: int


def chunk_text(
    text: str,
    chunk_size: int = 1000,
    overlap: int = 150,
) -> list[TextChunk]:

    if not text or not text.strip():
        return []

    chunks: list[TextChunk] = []

    start = 0
    seq = 0
    text_length = len(text)

    while start < text_length:
        target_end = min(start + chunk_size, text_length)
        end = target_end

        # 가능하면 문단 경계에서 자르기
        if target_end < text_length:
            paragraph_break = text.rfind(
                "\n\n",
                start + chunk_size // 2,
                target_end,
            )

            if paragraph_break != -1:
                end = paragraph_break

        # 앞뒤 공백 제거하면서 실제 위치도 보정
        raw_chunk = text[start:end]

        left_trim = len(raw_chunk) - len(raw_chunk.lstrip())
        right_trim = len(raw_chunk) - len(raw_chunk.rstrip())

        actual_start = start + left_trim
        actual_end = end - right_trim

        content = text[actual_start:actual_end]

        if content:
            chunks.append(
                TextChunk(
                    seq=seq,
                    content=content,
                    start_char=actual_start,
                    end_char=actual_end,
                )
            )
            seq += 1

        if end >= text_length:
            break

        next_start = end - overlap

        if next_start <= start:
            next_start = end

        start = next_start

    return chunks