import React, { useEffect, useMemo, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Piece, Square } from "react-chessboard/dist/chessboard/types";
import { Chess, Move, PieceSymbol } from "chess.js";

import { defaultRootNode } from "shared/constants/utils";
import { isMovePromotion } from "shared/lib/utils/chess";
import useResizeObserver from "@/hooks/useResizeObserver";
import PlayerProfile from "@/components/chess/PlayerProfile";
import EvaluationBar from "../EvaluationBar";

import { useSquares } from "./squares/useSquares";
import createSquareRenderer from "./squares/SquareRenderer";
import { SquaresContext } from "./squares/SquaresContext";

import BoardProps from "./BoardProps";
import * as styles from "./Board.module.css";

type ClickMove = Pick<Move, "from" | "to">;

const pieceStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
    filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.35))",
    WebkitUserDrag: "none",
    userSelect: "none",
} as React.CSSProperties;

const chessComPieces: Record<string, string> = {
    wP: "https://images.chesscomfiles.com/chess-themes/pieces/neo/256/wp.png",
    wR: "https://images.chesscomfiles.com/chess-themes/pieces/neo/256/wr.png",
    wN: "https://images.chesscomfiles.com/chess-themes/pieces/neo/256/wn.png",
    wB: "https://images.chesscomfiles.com/chess-themes/pieces/neo/256/wb.png",
    wQ: "https://images.chesscomfiles.com/chess-themes/pieces/neo/256/wq.png",
    wK: "https://images.chesscomfiles.com/chess-themes/pieces/neo/256/wk.png",
    bP: "https://images.chesscomfiles.com/chess-themes/pieces/neo/256/wp.png",
    bR: "https://images.chesscomfiles.com/chess-themes/pieces/neo/256/wr.png",
    bN: "https://images.chesscomfiles.com/chess-themes/pieces/neo/256/wn.png",
    bB: "https://images.chesscomfiles.com/chess-themes/pieces/neo/256/wb.png",
    bQ: "https://images.chesscomfiles.com/chess-themes/pieces/neo/256/wq.png",
    bK: "https://images.chesscomfiles.com/chess-themes/pieces/neo/256/wk.png"
};

function getPieceType(piece: Piece) {
    return piece.at(1)?.toLowerCase() as PieceSymbol;
}

function Board({
    className,
    style,
    profileClassName,
    profileStyle,
    whiteProfile,
    blackProfile,
    theme,
    piecesDraggable = true,
    node = defaultRootNode,
    flipped,
    evaluation,
    arrows,
    enableClassifications = true,
    onAddMove,
    onResize
}: BoardProps) {
    const squares = useSquares();

    const squareRenderer = useMemo(() => (
        createSquareRenderer(node, enableClassifications)
    ), [node, enableClassifications]);

    const customPieces = useMemo(() => {
        const mapping: Record<string, React.ComponentType<any>> = {};

        Object.entries(chessComPieces).forEach(([key, url]) => {
            const isBlack = key.startsWith("b");
            const style = isBlack
                ? { ...pieceStyle, filter: "brightness(0.35) contrast(1.2) saturate(0.9) drop-shadow(0 1px 1px rgba(0,0,0,0.35))" }
                : pieceStyle;

            mapping[key] = ({ squareWidth }) => <div style={{
                ...style,
                width: squareWidth,
                height: squareWidth,
                backgroundImage: `url(${url})`,
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center"
            }} />;
        });

        return mapping;
    }, [node.state.fen]);

    const [heldPromotion, setHeldPromotion] = useState<ClickMove>();

    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const { fullWidth: availableWidth, fullHeight } = useResizeObserver(wrapperRef, 1);

    const [windowHeight, setWindowHeight] = useState(
        typeof window !== "undefined" ? window.innerHeight : 900
    );

    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleResize = () => setWindowHeight(window.innerHeight);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const boardWidth = useMemo(() => {
        const viewportBound = Math.min(
            typeof window != "undefined" ? window.innerWidth * 0.84 : 1200,
            windowHeight - 260, // Subtract header/profile chrome (approx 260px)
            1180
        );

        const target = availableWidth
            ? Math.min(Math.max(availableWidth, 280), viewportBound)
            : viewportBound;

        return Math.max(Math.min(target, 1180), 280);
    }, [availableWidth, windowHeight]);

    useEffect(() => {
        if (boardWidth && onResize) {
            onResize(boardWidth);
        }
    }, [boardWidth, onResize]);

    const topProfile = flipped ? whiteProfile : blackProfile;
    const bottomProfile = flipped ? blackProfile : whiteProfile;

    function onSquareClick(square: Square, piece?: Piece) {
        squares.setHighlighted([]);

        if (!piece || square == squares.selected) {
            squares.setSelected(undefined);
            squares.clearPlayable();
        } else {
            squares.setSelected(square);
            squares.loadPlayable(node.state.fen, square);
        }

        if (!squares.selected) return;
        if (
            !squares.playable.includes(square)
            && !squares.capturable.includes(square)
        ) return;

        const selectedPiece = new Chess(node.state.fen)
            .get(squares.selected);

        if (selectedPiece && isMovePromotion(selectedPiece.type, square)) {
            setHeldPromotion({
                from: squares.selected,
                to: square
            });
        }

        addMove(squares.selected, square);
    }

    function onPromotionPieceSelect(
        piece?: Piece, from?: Square, to?: Square
    ) {
        if (!piece || !to) return false;

        setHeldPromotion(undefined);

        const fromSquare = heldPromotion?.from || from;
        if (!fromSquare) return false;

        return addMove(fromSquare, to, getPieceType(piece));
    }

    function addMove(
        from: Square, to: Square, promotion?: PieceSymbol,
        drop?: boolean
    ) {
        try {
            const move = new Chess(node.state.fen)
                .move({ from, to, promotion });

            squares.setPieceDropFlag(drop || false);

            return onAddMove?.(move) || true;
        } catch {
            return false;
        }
    }

    const evalData = evaluation || { type: "centipawn" as const, value: 0 };
    const profileWidthStyle = boardWidth
        ? { maxWidth: `${boardWidth}px` }
        : undefined;

    return <div
        className={`${styles.wrapper} ${className}`}
        style={style}
        ref={wrapperRef}
    >
        {topProfile && <div
            className={`${styles.profile} ${profileClassName}`}
            style={{
                borderRadius: "7px 7px 0 0",
                ...profileWidthStyle,
                ...profileStyle
            }}
        >
            <PlayerProfile profile={topProfile} />
        </div>}

        <div
            className={styles.boardContainer}
        >
            <div
                className={styles.evalBarWrap}
                style={{
                    height: `${boardWidth}px`,
                    width: '11px'
                }}
            >
                <EvaluationBar
                    evaluation={evalData}
                    moveColour={node.state.moveColour}
                    flipped={flipped}
                    style={{ height: "100%" }}
                />
            </div>

            <div
                className={styles.boardInner}
                style={{ width: `${boardWidth}px`, height: `${boardWidth}px` }}
            >
                <SquaresContext.Provider value={squares}>
                    <Chessboard
                        position={node.state.fen}
                        boardOrientation={flipped ? "black" : "white"}
                        onSquareClick={onSquareClick}
                        onSquareRightClick={squares.toggleHighlight}
                        onPieceDragBegin={(piece, square) => {
                            squares.setSelected(square);
                            squares.loadPlayable(node.state.fen, square);
                        }}
                        onPieceDrop={(from, to, piece) => {
                            squares.setSelected(undefined);
                            squares.clearPlayable();

                            return addMove(from, to, getPieceType(piece), true);
                        }}
                        onPromotionPieceSelect={onPromotionPieceSelect}
                        customSquare={squareRenderer}
                        customArrows={arrows}
                        arePiecesDraggable={piecesDraggable}
                        customLightSquareStyle={theme?.lightSquareColour
                            ? { backgroundColor: theme.lightSquareColour }
                            : undefined
                        }
                        customDarkSquareStyle={theme?.darkSquareColour
                            ? { backgroundColor: theme.darkSquareColour }
                            : undefined
                        }
                        customPieces={customPieces}
                        animationDuration={165}
                        showPromotionDialog={!!heldPromotion}
                        promotionToSquare={heldPromotion?.to}
                        promotionDialogVariant="vertical"
                        boardWidth={boardWidth}
                    />
                </SquaresContext.Provider>
            </div>
        </div>

        {bottomProfile && <div
            className={`${styles.profile} ${profileClassName}`}
            style={{
                borderRadius: "0 0 7px 7px",
                ...profileWidthStyle,
                ...profileStyle
            }}
        >
            <PlayerProfile profile={bottomProfile} />
        </div>}
    </div>;
}

export default Board;
