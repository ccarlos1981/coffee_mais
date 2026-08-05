import { DecisionGraphNode } from "../dto/decision-dto";

export class DecisionGraphBuilder {
  private nodes: DecisionGraphNode[] = [];

  public addNode(node: DecisionGraphNode): void {
    this.nodes.push(node);
  }

  public getNodes(): DecisionGraphNode[] {
    return [...this.nodes];
  }
}
