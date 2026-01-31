import { StatusCodes } from "http-status-codes";
import { clone } from "lodash-es";

import AnalysisOptions from "shared/lib/reporter/types/AnalysisOptions";
import {
    GameAnalysis,
    SerializedGameAnalysis
} from "shared/types/game/GameAnalysis";
import {
    StateTreeNode,
    serializeNode,
    deserializeNode
} from "shared/types/game/position/StateTreeNode";
import { getGameAnalysis } from "shared/lib/reporter/report";
import APIResponse from "@/types/APIResponse";

export async function analyseStateTree(
    rootNode: StateTreeNode,
    options?: AnalysisOptions
): APIResponse<{ gameAnalysis: GameAnalysis }> {
    // Local/offline: run reporter logic client-side to classify/accuracy
    const analysis = getGameAnalysis(rootNode, options);

    return {
        status: StatusCodes.OK,
        gameAnalysis: {
            ...analysis,
            stateTree: analysis.stateTree
        }
    };
}

export async function analyseNode(
    node: StateTreeNode,
    options?: AnalysisOptions
): APIResponse<{ node: StateTreeNode }> {
    if (!node.parent)
        return { status: StatusCodes.BAD_REQUEST };

    const childlessNode = clone(node);
    childlessNode.children = [];

    const parentNode = clone(node.parent);
    parentNode.children = [childlessNode];

    const reportResult = await analyseStateTree(parentNode, options);
    const analysedNode = reportResult.gameAnalysis?.stateTree.children.at(0);

    return {
        status: reportResult.status,
        node: analysedNode
    };
}
