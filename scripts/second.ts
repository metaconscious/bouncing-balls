// setup canvas

const canvas: HTMLCanvasElement = document.querySelector('canvas');
const ctx: CanvasRenderingContext2D = canvas.getContext('2d');

const width: number = canvas.width = window.innerWidth;
const height: number = canvas.height = window.innerHeight;

// function to generate random number

function random(min, max): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// function to generate random color

function randomRGB(): string {
    return `rgb(${random(0, 255)},${random(0, 255)},${random(0, 255)})`;
}

// 2d vector class and its util function

class Vector2d {

    x: number;
    y: number;

    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    innerProduct(vector): number {
        return this.x * vector.x + this.y * vector.y;
    }

    magnitudeSquare(): number {
        return this.innerProduct(this);
    }

    norm(): number {
        return Math.sqrt(this.magnitudeSquare());
    }

    normalize(): Vector2d {
        const norm = this.norm();
        return new Vector2d(this.x / norm, this.y / norm);
    }

    negate(): Vector2d {
        return new Vector2d(-this.x, -this.y);
    }

    scaleBy(scalar: number): Vector2d {
        return new Vector2d(this.x * scalar, this.y * scalar);
    }

    add(vector: Vector2d): Vector2d {
        return new Vector2d(this.x + vector.x, this.y + vector.y);
    }

    addAssign(vector: Vector2d): void {
        this.x += vector.x;
        this.y += vector.y;
    }

    // v1-v2 = v1 + (-v2)
    minus(vector: Vector2d): Vector2d {
        return this.add(vector.negate());
    }

    minusAssign(vector: Vector2d): void {
        this.x -= vector.x;
        this.y -= vector.y;
    }

    // d = || v1-v2 ||
    distanceTo(vector: Vector2d): number {
        return this.minus(vector).norm();
    }

    toString(): String {
        return `(${this.x}, ${this.y})`;
    }


}

// quadratic equation solver

class QuadraticEquation {

    a: number;
    b: number;
    c: number;

    // ax^2 + bx + c = 0
    constructor(a: number, b: number, c: number) {
        this.a = a;
        this.b = b;
        this.c = c;
    }

    delta(): number {
        return this.b ** 2 - 4 * this.a * this.c;
    }

    numberOfRealRoots(): number {
        const delta = this.delta();
        if (delta < 0) {
            return 0;
        } else if (delta === 0) {
            return 1;
        } else {
            return 2;
        }
    }

    realRootsExist(): boolean {
        return this.delta() >= 0;
    }

    roots(): Array<number> {
        const roots: Array<number> = [];
        const rootNum: number = this.numberOfRealRoots();
        if (rootNum === 0) {
            return roots;
        } else {
            const aa: number = 2 * this.a;
            const firstTerm: number = (-this.b) / aa;
            if (rootNum === 1) {
                roots.push(firstTerm);
            } else {
                const delta: number = this.delta();
                const lastTerm: number = Math.sqrt(delta) / aa;
                roots.push(firstTerm + lastTerm);
                roots.push(firstTerm - lastTerm);
            }
        }
        return roots;
    }

}

// physics engine

interface Engine {
    update(): void;
}

interface MassPoint extends Engine {
    getMass(): number;

    getMomentum(): Vector2d;

    getKineticEnergy(): number;
}

// parameters' order affect final result
function getCollisionScaleFactor(b1: PhysicalBody, b2: PhysicalBody): number {
    return 2 * b2.getMass() / (b1.getMass() + b2.getMass());
}

interface PhysicalBody extends MassPoint {

    collideBy(physicalBody: PhysicalBody): void;

    collisionDetect(): void;
}

// ball
interface Drawable {
    draw(): void;
}

// physical ball

class Ball implements PhysicalBody, Drawable{

    static copy(ball: Ball) {
        const temp: Ball = JSON.parse(JSON.stringify(ball));
        return new Ball(temp.position.x, temp.position.y, temp.velocity.x, temp.velocity.y, temp.color, temp.radius);
    }

    position: Vector2d;
    velocity: Vector2d;
    color: string;
    radius: number;
    coefficientOfMass: number;

    // mass = k * PI * r^2

    constructor(x: number, y: number, velocityX: number, velocityY: number, color: string, radius: number) {
        this.position = new Vector2d(x, y);
        this.velocity = new Vector2d(velocityX, velocityY);
        this.color = color;
        this.radius = radius;
        this.coefficientOfMass = 10;
    }

    getMass(): number {
        return this.coefficientOfMass * Math.PI * (this.radius ** 2);
    }

    getMomentum(): Vector2d {
        return this.velocity.scaleBy(this.getMass());
    }

    getKineticEnergy(): number {
        return this.velocity.magnitudeSquare() * this.getMass() / 2;
    }

    draw(): void {
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.arc(this.position.x, this.position.y, this.radius, 0, 2 * Math.PI);
        ctx.fill();
    }

    update(): void {
        if ((this.position.x + this.radius) >= width || (this.position.x + this.radius) <= 0) {
            this.velocity.x = -this.velocity.x;
        }

        if ((this.position.y + this.radius) >= height || (this.position.y + this.radius) <= 0) {
            this.velocity.y = -this.velocity.y;
        }

        this.position.addAssign(this.velocity);
    }

    collideBy(ball: Ball): void {
        const diffPos: Vector2d = this.position.minus(ball.position);
        const diffVel: Vector2d = this.velocity.minus(ball.velocity);

        const csf: number = getCollisionScaleFactor(this, ball);
        this.velocity.minusAssign(diffPos.normalize().scaleBy(csf * diffPos.innerProduct(diffVel) / diffPos.norm()));
    }

    collisionDetect(): void {

        for (const ball of balls) {
            if (this !== ball) {
                const distance: number = this.position.distanceTo(ball.position);

                if (distance < this.radius + ball.radius) {
                    // remove chemical-bonding-like side effect
                    // do this before collide to have better collision simulation
                    deoverlap(this, ball);
                    collide(this, ball);
                    ball.color = this.color = randomRGB();
                }
            }
        }
    }

}

function deoverlap(b1: Ball, b2: Ball): void {
    // x1 = x1' - v1*t, t = 1
    b1.position.minusAssign(b1.velocity);
    b2.position.minusAssign(b2.velocity);
    const dx: Vector2d = b1.position.minus(b2.position);
    const dv: Vector2d = b1.velocity.minus(b2.velocity);
    const qe: QuadraticEquation = new QuadraticEquation(
        dv.magnitudeSquare(),
        dx.innerProduct(dv),
        dx.magnitudeSquare() - (b1.radius + b2.radius)
    );
    const roots: Array<number> = qe.roots();
    for (const root of roots) {
        if (-1 < root && root < 1) {
            b1.position.addAssign(b1.velocity.scaleBy(root));
            b2.position.addAssign(b2.velocity.scaleBy(root));
        }
    }
}

function collide(b1: Ball, b2: Ball): void {
    const temp: Ball = Ball.copy(b1);
    b1.collideBy(b2);
    b2.collideBy(temp);
}

const balls = [];

function initializeBalls(): void {
    while (balls.length < 25) {
        const size = random(10, 20);
        const ball = new Ball(
            random(0 + size, width - size),
            random(0 + size, height - size),
            random(-7, 7),
            random(-7, 7),
            randomRGB(),
            size
        );
        balls.push(ball);
    }
}

initializeBalls();

const kineticEnergyInfo: HTMLHeadingElement = document.querySelector('.kinetic');
const momentumInfo: HTMLHeadingElement = document.querySelector('.momentum');

function loop(): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, 0, width, height);

    let totalKineticEnergy: number = 0;
    let totalMomentum: Vector2d = new Vector2d(0, 0);

    for (const ball of balls) {
        totalKineticEnergy += ball.getKineticEnergy();
        totalMomentum.addAssign(ball.getMomentum());
        ball.draw();
        ball.update();
        ball.collisionDetect();
    }

    kineticEnergyInfo.textContent = `System Kinetic Energy: ${totalKineticEnergy}`;
    momentumInfo.textContent = `System Momentum: ${totalMomentum.toString()}`;

    requestAnimationFrame(loop);
}

loop();